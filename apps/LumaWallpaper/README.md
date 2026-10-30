# Luma 3 — Living Worlds

Nine animated wallpapers for the click-through ChatGPT desktop overlay.

## Start the update

1. Quit your current Luma from its tray menu or controls. Clicking X only hides the controls.
2. Open Luma.exe in this LumaWallpaper3 folder.
3. Select ChatGPT, choose Aquarium or Pac-Man arcade, and click Start wallpaper.

The previous versions remain available in their own folders. Only one version can run at a time.

## New: Aquarium

Colorful tropical fish swim in both directions at different depths and speeds. Fish have animated tails and fins, with clownfish stripes, neon stripes, and tall angelfish shapes. Plants sway along the bottom, bubbles rise, and translucent underwater light crosses the scene. Scene density controls fish and bubble counts.

## New: Pac-Man arcade

A self-playing maze scene with pellets, four chasing ghosts, power pellets, frightened ghosts, score, levels, and lives. The player chooses legal routes toward pellets while avoiding nearby ghosts. Ghosts chase and periodically scatter; power pellets reverse the chase. Collisions lose a life or eat a frightened ghost. Game over restarts automatically; clearing pellets begins another level.

This is a decorative simulation, not a keyboard-controlled game. It uses an original generated maze, not a recording. The scene begins a fresh simulation every four minutes to keep catch-up bounded when switching wallpapers. Density changes the surrounding particles without changing gameplay rules.

## All scenes

Aquarium, Pac-Man arcade, Neon vortex, Aurora rave, Synthwave highway, Rainbow jellyfish, Koi pond, Fireflies, Star drift.

## Controls

- Preview opens a live scene window; adjust settings in the control panel beside it.
- Go wild sets 88% visibility, 1.25x speed, 1.8x density, and quiet center off.
- Readable sets 45% visibility, 0.75x speed, 1x density, and quiet center on.
- Visibility goes up to 100%, speed to 2.5x, and density to 2.4x.
- Ctrl + Alt + Shift + W hides/shows the overlay.
- Double-click the Luma 3 tray icon to reopen controls. It may be under hidden icons.
- Pause hides the overlay and freezes its animation clock.
- Stop turns the overlay off until Start wallpaper is clicked again.
- Quit exits completely. Closing the controls with X keeps Luma in the tray.

The overlay follows the attached window and hides when another app is active or the attached window is minimized. The controls are another window, so click Start wallpaper after changing settings to return to ChatGPT. Refresh and reattach if ChatGPT restarts.

## Notes

This remains an overlay over the app, not a native ChatGPT background. Colors and objects may visually cover text at high visibility; quiet center and lower visibility reduce that. Input passes through the overlay. The aquarium includes a faint water tint, and the arcade includes a translucent backing behind its maze.

No ChatGPT files are changed. Luma does not read conversations, capture the screen, use the network, require an API key, or install startup entries. It reads window titles and geometry for attachment. Settings are stored beside the executable in settings.xml.

Windows x64 and .NET Framework 4.8 are required. No installation or administrator access is needed. The executable is locally built and unsigned. Higher density and larger windows require more rendering work. Desktop recordings may include the overlay; recordings of ChatGPT alone may exclude it.

## Build and validation

Luma.cs contains the controller and window tracking. NeonScenes.cs contains the previous neon scenes. LivingScenes.cs contains the aquarium and arcade renderers. MazeGame.cs contains the grid simulation.

Build with the installed .NET Framework compiler, without downloading dependencies:

```powershell
& .\Build.ps1
```

The original overlay was confirmed working by you. This version preserves its click-through and window-tracking behavior. Off-screen tests cover all nine scenes: visible output, motion, quiet-center attenuation, and density changes. Simulation tests run 2,000 ticks, checking legal moves and pellet accounting, plus power-pellet progress, ordinary and frightened collisions, crossing collisions, and automatic game-over restart. New scenes have not been retested interactively inside ChatGPT.

A local input test window is available with:

```powershell
.\Luma.exe --demo
```

To remove Luma, quit it and delete its folder.
