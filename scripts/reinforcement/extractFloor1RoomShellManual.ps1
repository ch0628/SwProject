param(
  [string]$Source = 'C:\Users\ASUS\Downloads\미래형 복도 타일 세트.png'
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$outputDir = Join-Path $root 'public\assets\environment\reinforcement\floor1_room_shell_manual'
$mapPath = Join-Path $root 'public\maps\reinforcement\floor_1_blockout.tmj'
$mapHashBefore = (Get-FileHash -Algorithm SHA256 -LiteralPath $mapPath).Hash
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Add-Type -AssemblyName System.Drawing.Common
$drawingDir = Split-Path ([System.Drawing.Bitmap].Assembly.Location)
$drawingReferences = @(
  [System.Drawing.Bitmap].Assembly.Location
  [System.Drawing.Rectangle].Assembly.Location
  [System.Object].Assembly.Location
  (Join-Path $drawingDir 'System.Runtime.dll')
  (Join-Path $drawingDir 'System.Collections.dll')
  (Join-Path $drawingDir 'System.Runtime.InteropServices.dll')
  (Join-Path $drawingDir 'System.IO.FileSystem.dll')
  (Join-Path $drawingDir 'System.Private.Windows.GdiPlus.dll')
  (Join-Path $drawingDir 'System.Private.Windows.Core.dll')
)
Add-Type -ReferencedAssemblies $drawingReferences -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class Floor1ManualExtractor
{
    private sealed class Asset
    {
        public string Name;
        public Rectangle Source;
        public int Width, Height, MaxWidth, MaxHeight;
        public string Align;
        public Asset(string name, Rectangle source, int width, int height, int maxWidth, int maxHeight, string align)
        { Name = name; Source = source; Width = width; Height = height; MaxWidth = maxWidth; MaxHeight = maxHeight; Align = align; }
    }

    private static readonly Asset[] Assets = new Asset[] {
        new Asset("F1_FLOOR_PUBLIC",       new Rectangle(47, 1081, 200, 200), 32, 32, 32, 32, "fill"),
        new Asset("F1_FLOOR_SERVICE",      new Rectangle(297,1081, 200, 200), 32, 32, 32, 32, "fill"),
        new Asset("F1_BACK_WALL_PLAIN",    new Rectangle(471, 101, 176, 352), 32, 64, 32, 64, "fill"),
        new Asset("F1_BACK_WALL_VARIANT_A",new Rectangle(692, 101, 176, 352), 32, 64, 32, 64, "fill"),
        new Asset("F1_BACK_WALL_VARIANT_B",new Rectangle(912, 101, 176, 352), 32, 64, 32, 64, "fill"),
        new Asset("F1_SIDE_WALL_LEFT",     new Rectangle(868,1088,  64, 192), 32, 32, 11, 32, "left"),
        new Asset("F1_SIDE_WALL_RIGHT",    new Rectangle(1021,1088, 64, 192), 32, 32, 11, 32, "right"),
        new Asset("F1_SIDE_END_TOP",       new Rectangle(720,1080,  70,  68), 32, 32, 32, 32, "top"),
        new Asset("F1_SIDE_END_BOTTOM",    new Rectangle(720,1220,  70,  70), 32, 32, 32, 32, "bottom"),
        new Asset("F1_BACK_CORNER_LEFT",   new Rectangle( 34, 101, 169, 338), 32, 64, 32, 64, "fill"),
        new Asset("F1_BACK_CORNER_RIGHT",  new Rectangle(236, 101, 169, 338), 32, 64, 32, 64, "fill"),
        new Asset("F1_DOOR_H_CLOSED",      new Rectangle( 49, 550, 474, 435), 64, 64, 64, 64, "bottom"),
        new Asset("F1_DOOR_H_OPEN",        new Rectangle(602, 550, 471, 435), 64, 64, 64, 64, "bottom"),
    };

    private static bool IsBackground(byte b, byte g, byte r)
    {
        int min = Math.Min(r, Math.Min(g, b));
        int max = Math.Max(r, Math.Max(g, b));
        int mean = (r + g + b) / 3;
        return mean >= 85 && mean <= 135 && max - min <= 14;
    }

    private static Bitmap LoadWithConnectedBackgroundRemoved(string path)
    {
        using (var input = new Bitmap(path)) {
            var image = new Bitmap(input.Width, input.Height, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(image)) {
                g.CompositingMode = CompositingMode.SourceCopy;
                g.DrawImageUnscaled(input, 0, 0);
            }

            var rect = new Rectangle(0, 0, image.Width, image.Height);
            var data = image.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            var bytes = new byte[Math.Abs(data.Stride) * data.Height];
            Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
            var outside = new bool[image.Width * image.Height];
            var queue = new int[outside.Length];
            int head = 0, tail = 0;

            void Enqueue(int x, int y) {
                int id = y * image.Width + x;
                if (outside[id]) return;
                int p = y * data.Stride + x * 4;
                if (!IsBackground(bytes[p], bytes[p + 1], bytes[p + 2])) return;
                outside[id] = true;
                queue[tail++] = id;
            }
            for (int x = 0; x < image.Width; x++) { Enqueue(x, 0); Enqueue(x, image.Height - 1); }
            for (int y = 0; y < image.Height; y++) { Enqueue(0, y); Enqueue(image.Width - 1, y); }

            while (head < tail) {
                int id = queue[head++], x = id % image.Width, y = id / image.Width;
                if (x > 0) Enqueue(x - 1, y);
                if (x + 1 < image.Width) Enqueue(x + 1, y);
                if (y > 0) Enqueue(x, y - 1);
                if (y + 1 < image.Height) Enqueue(x, y + 1);
            }

            for (int id = 0; id < outside.Length; id++) if (outside[id]) {
                int x = id % image.Width, y = id / image.Width, p = y * data.Stride + x * 4;
                bytes[p] = bytes[p + 1] = bytes[p + 2] = bytes[p + 3] = 0;
            }
            Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
            image.UnlockBits(data);
            return image;
        }
    }

    private static Bitmap Render(Bitmap source, Asset asset)
    {
        var result = new Bitmap(asset.Width, asset.Height, PixelFormat.Format32bppArgb);
        int drawWidth = asset.MaxWidth, drawHeight = asset.MaxHeight;
        if (asset.Align != "fill") {
            double scale = Math.Min((double)asset.MaxWidth / asset.Source.Width, (double)asset.MaxHeight / asset.Source.Height);
            drawWidth = Math.Max(1, (int)Math.Round(asset.Source.Width * scale));
            drawHeight = Math.Max(1, (int)Math.Round(asset.Source.Height * scale));
        }
        int x = asset.Align == "right" ? asset.Width - drawWidth : asset.Align == "left" ? 0 : (asset.Width - drawWidth) / 2;
        int y = asset.Align == "top" ? 0 : asset.Height - drawHeight;
        using (var g = Graphics.FromImage(result)) {
            g.CompositingMode = CompositingMode.SourceCopy;
            g.CompositingQuality = CompositingQuality.HighQuality;
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            using (var attributes = new ImageAttributes()) {
                attributes.SetWrapMode(WrapMode.TileFlipXY);
                g.DrawImage(source, new Rectangle(x, y, drawWidth, drawHeight), asset.Source.X, asset.Source.Y,
                    asset.Source.Width, asset.Source.Height, GraphicsUnit.Pixel, attributes);
            }
        }
        SharpenAlpha(result);
        return result;
    }

    private static void SharpenAlpha(Bitmap image)
    {
        var rect = new Rectangle(0, 0, image.Width, image.Height);
        var data = image.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        var bytes = new byte[Math.Abs(data.Stride) * data.Height];
        Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
        for (int y = 0; y < image.Height; y++) for (int x = 0; x < image.Width; x++) {
            int p = y * data.Stride + x * 4, a = bytes[p + 3];
            if (a <= 32) bytes[p] = bytes[p + 1] = bytes[p + 2] = bytes[p + 3] = 0;
            else if (a >= 224) bytes[p + 3] = 255;
            else bytes[p + 3] = (byte)((a - 32) * 255 / 192);
        }
        Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
        image.UnlockBits(data);
    }

    private static void DrawChecker(Graphics g, Rectangle area)
    {
        const int size = 8;
        using (var a = new SolidBrush(Color.FromArgb(255, 55, 59, 64)))
        using (var b = new SolidBrush(Color.FromArgb(255, 75, 80, 86)))
            for (int y = area.Top; y < area.Bottom; y += size) for (int x = area.Left; x < area.Right; x += size)
                g.FillRectangle((((x - area.Left) / size + (y - area.Top) / size) & 1) == 0 ? a : b,
                    x, y, Math.Min(size, area.Right - x), Math.Min(size, area.Bottom - y));
    }

    public static void Run(string sourcePath, string outputDir)
    {
        Directory.CreateDirectory(outputDir);
        using (var source = LoadWithConnectedBackgroundRemoved(sourcePath)) {
            foreach (var asset in Assets) using (var image = Render(source, asset))
                image.Save(Path.Combine(outputDir, asset.Name + ".png"), ImageFormat.Png);
        }

        var preview = new Bitmap(800, 600, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(preview))
        using (var label = new Font("Segoe UI", 10, FontStyle.Bold, GraphicsUnit.Pixel))
        using (var text = new SolidBrush(Color.White)) {
            g.Clear(Color.FromArgb(255, 35, 39, 44));
            g.TextRenderingHint = System.Drawing.Text.TextRenderingHint.SingleBitPerPixelGridFit;
            for (int i = 0; i < Assets.Length; i++) {
                int column = i % 4, row = i / 4;
                var cell = new Rectangle(column * 200 + 8, row * 145 + 8, 184, 129);
                var checker = new Rectangle(cell.X + 36, cell.Y + 4, 112, 96);
                DrawChecker(g, checker);
                using (var image = new Bitmap(Path.Combine(outputDir, Assets[i].Name + ".png"))) {
                    int scale = Math.Max(1, Math.Min(3, Math.Min(checker.Width / image.Width, checker.Height / image.Height)));
                    int w = image.Width * scale, h = image.Height * scale;
                    g.InterpolationMode = InterpolationMode.NearestNeighbor;
                    g.PixelOffsetMode = PixelOffsetMode.Half;
                    g.DrawImage(image, checker.X + (checker.Width - w) / 2, checker.Y + checker.Height - h, w, h);
                }
                g.DrawString(Assets[i].Name, label, text, cell.X + 2, cell.Y + 106);
            }
        }
        preview.Save(Path.Combine(outputDir, "floor1_room_shell_manual_preview.png"), ImageFormat.Png);
        preview.Dispose();
    }
}
'@

[Floor1ManualExtractor]::Run($Source, $outputDir)

$assetSpecs = @(
  @('F1_FLOOR_PUBLIC',        32, 32, 32, 32, 'public 2x2 floor panel at (47,1081,200,200)'),
  @('F1_FLOOR_SERVICE',       32, 32, 32, 32, 'service 2x2 floor panel at (297,1081,200,200)'),
  @('F1_BACK_WALL_PLAIN',     32, 64, 32, 32, 'plain upper wall panel at (471,101,176,352)'),
  @('F1_BACK_WALL_VARIANT_A', 32, 64, 32, 32, 'cyan console wall panel at (692,101,176,352)'),
  @('F1_BACK_WALL_VARIANT_B', 32, 64, 32, 32, 'three-control wall panel at (912,101,176,352)'),
  @('F1_SIDE_WALL_LEFT',      32, 32, 32, 32, 'left isolated vertical shell at (868,1088,64,192)'),
  @('F1_SIDE_WALL_RIGHT',     32, 32, 32, 32, 'right isolated vertical shell at (1021,1088,64,192)'),
  @('F1_SIDE_END_TOP',        32, 32, 32, 32, 'capped pillar top at (720,1080,70,68)'),
  @('F1_SIDE_END_BOTTOM',     32, 32, 32, 32, 'capped pillar base at (720,1220,70,70)'),
  @('F1_BACK_CORNER_LEFT',    32, 64, 32, 32, 'left wall-to-side corner at (34,101,169,338)'),
  @('F1_BACK_CORNER_RIGHT',   32, 64, 32, 32, 'right wall-to-side corner at (236,101,169,338)'),
  @('F1_DOOR_H_CLOSED',       64, 64, 64, 32, 'large closed double door at (49,550,474,435)'),
  @('F1_DOOR_H_OPEN',         64, 64, 64, 32, 'large open double door at (602,550,471,435)')
)

$tiles = for ($id = 0; $id -lt $assetSpecs.Count; $id++) {
  $spec = $assetSpecs[$id]
  [ordered]@{
    id = $id
    class = $spec[0]
    image = "$($spec[0]).png"
    imagewidth = $spec[1]
    imageheight = $spec[2]
    properties = @(
      [ordered]@{ name = 'assetId'; type = 'string'; value = $spec[0] }
      [ordered]@{ name = 'logicalFootprintWidth'; type = 'int'; value = $spec[3] }
      [ordered]@{ name = 'logicalFootprintHeight'; type = 'int'; value = $spec[4] }
      [ordered]@{ name = 'anchor'; type = 'string'; value = 'bottom-left' }
      [ordered]@{ name = 'sourceRegion'; type = 'string'; value = $spec[5] }
    )
  }
}

$tileset = [ordered]@{
  columns = 0
  grid = [ordered]@{ height = 32; orientation = 'orthogonal'; width = 32 }
  margin = 0
  name = 'floor1_room_shell_manual'
  objectalignment = 'bottomleft'
  spacing = 0
  tilecount = 13
  tileheight = 64
  tileoffset = [ordered]@{ x = 0; y = 0 }
  tilewidth = 64
  transformations = [ordered]@{ hflip = $false; vflip = $false; rotate = $false; preferuntransformed = $true }
  type = 'tileset'
  version = '1.10'
  tiledversion = '1.12.2'
  properties = @(
    [ordered]@{ name = 'gameplayGridPx'; type = 'int'; value = 32 }
    [ordered]@{ name = 'authoringMode'; type = 'string'; value = 'manual-placement' }
    [ordered]@{ name = 'masterSource'; type = 'string'; value = '미래형 복도 타일 세트.png' }
  )
  tiles = $tiles
}

$tsjPath = Join-Path $outputDir 'floor1_room_shell_manual.tsj'
$tileset | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $tsjPath -Encoding utf8

# Minimal validation: exact sizes/mode, transparent extraction, references, joins, and source-map immutability.
Add-Type -AssemblyName System.Drawing.Common
$expected = @{}
foreach ($spec in $assetSpecs) { $expected[$spec[0]] = @($spec[1], $spec[2]) }
foreach ($name in $expected.Keys) {
  $path = Join-Path $outputDir "$name.png"
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing asset: $name" }
  $image = [System.Drawing.Bitmap]::new($path)
  try {
    if ($image.Width -ne $expected[$name][0] -or $image.Height -ne $expected[$name][1]) { throw "Bad size: $name" }
    if ($image.PixelFormat -ne [System.Drawing.Imaging.PixelFormat]::Format32bppArgb) { throw "Not RGBA: $name ($($image.PixelFormat))" }
  } finally { $image.Dispose() }
}

foreach ($name in @('F1_BACK_WALL_PLAIN','F1_BACK_WALL_VARIANT_A','F1_BACK_WALL_VARIANT_B')) {
  $image = [System.Drawing.Bitmap]::new((Join-Path $outputDir "$name.png"))
  try {
    $leftOpaque = 0; $rightOpaque = 0
    for ($y = 0; $y -lt 64; $y++) {
      if ($image.GetPixel(0,$y).A -gt 0) { $leftOpaque++ }
      if ($image.GetPixel(31,$y).A -gt 0) { $rightOpaque++ }
    }
    if ($leftOpaque -lt 56 -or $rightOpaque -lt 56) { throw "Unexpected repeat-edge gap: $name" }
  } finally { $image.Dispose() }
}

$parsed = Get-Content -Raw -LiteralPath $tsjPath | ConvertFrom-Json
if ($parsed.tiles.Count -ne 13) { throw 'TSJ must contain 13 tiles' }
foreach ($tile in $parsed.tiles) {
  if (-not (Test-Path -LiteralPath (Join-Path $outputDir $tile.image))) { throw "Broken TSJ image reference: $($tile.image)" }
}
$mapHashAfter = (Get-FileHash -Algorithm SHA256 -LiteralPath $mapPath).Hash
if ($mapHashBefore -ne $mapHashAfter) { throw 'floor_1_blockout.tmj changed during extraction' }

Write-Host "PASS 13 RGBA assets + TSJ + preview"
Write-Host "floor_1_blockout.tmj SHA256=$mapHashAfter"
