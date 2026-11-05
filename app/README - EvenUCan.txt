EvenUCan  -  from idea to object 
Version 1.9.39
© 2026 David John Waugh. Free software under the GNU GPL v3 or later
(see LICENSE.txt). It comes with no warranty.

Draw your own 3D parts, or let EvenUCan design a printable box
(an "enclosure") around your electronics. Everything runs on your own
computer. The drawing, box design, wiring and ESPHome code all work
offline. The wizard's AI helper (turning your idea into a parts list,
and writing Arduino sketches) uses the internet with a free key from
Google Gemini or NVIDIA (desktop program), or your own paid Claude key
if you prefer - or you can carry on without AI. "Fill in automatically"
(looking up a part's sizes online) uses the same AI key.


=====================================================================
 IMPORTANT: A FREE AI KEY IS NEEDED TO START A NEW PROJECT
=====================================================================

"Describe your idea" - the wizard that turns a plain-English
description into a parts list, a box and code - needs an AI to do
that one translation. It is the only part of the whole program that
has to reach the internet.

  Bring your own free key. Five AIs work: Google Gemini, Groq and
  OpenRouter (all free, no card needed), NVIDIA (free, desktop program
  only), or your own paid Anthropic Claude key. Set one up on the
  wizard's first screen, or under "AI key" on the toolbar.

  Kept on your own computer only. Your key is saved in EvenUCan's own
  settings (never uploaded anywhere except the AI company you chose).

  Everything after that is offline. Once the AI has turned your idea
  into a parts list, the box designer, the wiring diagram and the
  ESPHome/Arduino/Pi code all run entirely on your own computer - the
  AI connection closes and is not needed again for that project.

  Don't want to use AI at all? Click "Carry on without AI" instead of
  describing your idea: start from one of six ready-made examples, or
  tick the parts you have. Everything else works exactly the same way.


=====================================================================
 GETTING STARTED
=====================================================================

You will have one of these two files. Either one is the whole program:

  EvenUCan-Portable-1.9.39.exe
      Just double-click it. Nothing is installed. It also works from
      a USB stick.

  EvenUCan-Setup-1.9.39.exe
      Installs the program with a Start menu and desktop shortcut.
      Uninstall it any time from Settings > Apps.

It needs Windows 10 or 11 (64-bit).

"Windows protected your PC"?
  The first time you run it, Windows may show this blue box because the
  program isn't "signed" by a big company. Click "More info", then
  "Run anyway". You only need to do this once.

First thing to do:
  Choose File > Printer size... at the top and pick your printer, or
  type its build size (X, Y and Z in mm). The app then warns you if
  anything is too big to print.

Fixed in 1.9.39: "Make it with AI" (in Wiring) could leave the buzzer,
relay, button or motion sensor it wrote silently unconnected - the
switch or sensor it just declared in the file had no name of its own
to act on, so it sometimes added a second, duplicate one on a pin that
isn't actually wired. Every one of these now gets its own stable name
in the file, and the AI is told to reuse it instead of inventing a new
one. A message to your phone (ntfy.sh) written by the AI could also
fail to compile if it forgot to turn that feature on in the file;
fixed too.
NEW in 1.9.38: the web version can now be installed like an app (a
manifest, icons and an offline service worker) - "Install" or "Add to
Home screen" in your browser puts EvenUCan on your desktop or phone
with its own icon and window. The built-in parts library was also
updated.
NEW in 1.9.37: the wizard is upfront about the AI helper. Its first
screen ("About the AI helper") says what the AI does, which free keys
work (Google Gemini, or NVIDIA in the desktop program), what is sent to
the AI company, and lets you set up and test a key there and then. No
key? Click "Carry on without AI": pick one of six example projects, or
tick the parts you have, and carry on to the box, the wiring and the
code. On the Code tab, "Make a starter sketch (no AI)" writes an Arduino
sketch (or Raspberry Pi program) with your pins already filled in, and
"Open in Arduino IDE" still opens it for you.
The wiring picture is now easy to read: only the pins in use are
labelled, outside the boards, and the labels never overlap. Wires are
coloured by job - red for power (dashed for 5 V), black for ground and
a colour of its own for each signal - with a key at the bottom. Click a
wire, a part or a line of the wiring list to see just that one with a
big label such as "GPIO8 -> SDA (SSD1306 OLED)"; "Show all" brings the
rest back. "One wire at a time" steps through them with Next and Back
in the same order as the list. Scroll (or pinch) to zoom, drag the
background to move about, and "Fit" shows it all. "Save picture" saves
the whole picture with every label.
Fixed: NVIDIA's free AI in the desktop program (and the photo, page and
datasheet look-ups of "Fill in automatically") now work - the desktop
program was missing the connection they need.

NEW in 1.9.36: Follow Me is easier. Click the shape (face), then click
the line it should follow - every line joined end-to-end to it turns
orange and is used. Or select the lines first, then choose Follow Me
and click the shape. The pipe or bar gets neat corners where the path
bends. Also fixed: the see-through outlines of the parts inside a box
from the Box designer now move with the box. Before, moving the box
left them behind as stray "ghost lines"; they also vanish now when you
undo or delete the box.

NEW in 1.9.35: the EvenUCan icon now sits at the top-left (click it for
About), and the buttons and menus have bright, colourful icons in the
same style as FreeCAD.

NEW in 1.9.34: a simple menu bar like every other program - File, Edit,
Draw, Modify, View, Tools and Help - instead of rows of buttons. The
drawing tools you use most stay as one row of buttons below it, and
"Start a project" (top right) starts the step-by-step guide.
Press F1 (or choose Help > Quick guide) at any time for a list of tools
and shortcuts. Choose Help > About EvenUCan to see which version you
have; it is also in the bottom-right corner of the 3D view.
Hover over any button to see its name, its shortcut key and what it does.
Also new: the Tape Measure leaves a guide point to draw to (type a
distance for an exact one; Shift+E deletes all guides), Shift+click with
Round rounds every edge of a box, and lines now snap to the red, green
and blue directions, so drawing straight up or in mid-air is easy.
Shortcut keys now match SketchUp: Offset is F (Round / Chamfer moved
to J) and Ctrl+T selects nothing. A quick right-click on the model
opens a menu of common jobs; right-click and drag still turns the view.
New shapes: Polygon (N) for hexagons, triangles and more, and 3D Shapes
(D) for a ball, cone, cylinder or pyramid in one go.
Slice (X) cuts a solid in two with a flat plane, so you can move or
delete either half (handy for printing a tall part in two pieces).
Check Model now fails any piece left floating in mid-air, with a
"Move down to rest" button to drop it onto what is below.
Copy, Cut and Paste for shapes: Ctrl+C, Ctrl+X, Ctrl+V (also in the
Edit menu and the right-click menu). Drag the tool buttons, or a group
by its dotted grip, to put them in your own order; right-click the row
of tool buttons to reset it.
NEW: ESPHome device file. In the Wiring window, the "ESPHome device"
tab writes the whole ESPHome YAML for your ESP32 board with the pins
from the wiring: choose Sensor node or Voice assistant, answer a few
questions, then Copy YAML or Save .yaml. "Check with ESPHome" checks it
with the ESPHome on your computer. "Send to ESPHome" puts the device
straight into ESPHome Device Builder on your computer and opens it: plug
the board in and click Install. Wi-Fi comes from ESPHome Secrets.
To make it do something: a "Light rule" (e.g. red above 28 C, green
otherwise), or describe it in "What should it do?" and click "Make it
with AI": your AI key adds it, ESPHome checks it, and any mistake goes
back to the AI to fix. DHT11/DHT22 and DS18B20 sensors are now known.
Parts it doesn't know (e.g. imported from a .fzpz file) need nothing
from you: "Make it with AI" writes their code from the part's name,
part-file description and pins (the part file's details are now kept
when you import it).
NEW: a parts library comes with the program. "Browse parts..." in Parts
(and in the Enclosure Wizard) lists over 2,000 ready-made parts. Search
by part number or by what it does, e.g. "gyroscope", "air quality" or
"screen", or pick a kind to scroll through; "Add to my box" adds it to
your enclosure in one click. "Import pins..." uses the same parts (sensors, boards, modules, displays)
with their pins, sizes and pictures, so Fritzing isn't needed. They come
from the Fritzing parts library, (c) Fritzing contributors, CC BY-SA 3.0.
New: the Round / Chamfer tool (J) rounds off or bevels the line where
two faces meet. Type 3 then Enter for a 3 mm rounding, or 3c for a
3 mm straight chamfer.
Also new: Arc (A), Offset (F) for a copy of a face's outline inside or
outside it, and Follow Me (W) to sweep a shape along a path. F1 shows
how each one works.
NEW: the view cube (top right corner) turns with the view. Click a face
of it to look straight at that side and draw on it (a light blue grid
shows the side; TOP is the ground), an edge or corner for an angled
view, or drag it to turn the view. A new, empty drawing starts with the
cube in the middle, asking which side you want to draw on.
NEW: sizes on shapes. A rectangle you have just drawn (or selected)
shows its two sides, a circle its diameter, a box its width, depth and
height. Click a size, type a new one and press Enter to change it.
NEW: Push/Pull several faces at once: Shift+click them, then click one
and pull. They rise together as one solid, with no walls between them.
NEW: Join (U) merges two or more objects into one solid for printing.
NEW: Subtract (S) cuts shapes out of an object (pick the object to keep
first, then Shift+click the shapes to cut out); Intersect keeps only the
overlap. Flip / Mirror turns the selection over or adds a mirrored copy
beside it. Lay flat: click the face that should go down on the bed.
3D Text: raised or engraved lettering in the fonts on your computer.
Shell hollows a solid out with walls of a set thickness (e.g. a tray).
Hole drills screw holes at printing sizes (M2 to M12): clearance, a real
metric thread, tapped, heat-set insert, countersunk, counterbored or nut
trap. Click a face. (Printed threads work best from M6 up.)
NEW: History. Every change is listed on the left. Click a step to go
back to just after it (like many Undos at once); the later steps turn
grey and can be clicked to go forward again, until you make a new change.
ALSO NEW SINCE 1.9.12:
Rotate (Q): with something already selected, just type a number of
degrees and press Enter - it spins round the selection's own centre
straight away, no clicks needed (the old click-centre-then-angle way
still works too, for an arbitrary centre or axis).
Mounting hole features can be set to a push-fit peg instead of a screw
post: the board drops straight onto a solid peg through its own hole,
poking a couple of mm proud so the tip can be melted flat afterwards to
rivet the board down for good.
The Rugged style's walls are now 5 mm (was 3), its gasket groove is a
full 3 mm wide (a common O-ring/gasket cord size, was 1.2 mm), and its
screw posts are raised to 6 mm so there's real depth for a screw or a
heat-set brass insert. Generate now also checks whether any wall
port/cut-out would breach the gasket groove and warns before you print.
For a Rugged box, "Generate base + lid" also prints a small accessory
for every hole it finds: a plug for each round wall hole/cable-gland,
and a push-fit rivet for each screw-post hole still left on "Screw
post". Each is its own separate piece, laid out in a grid in front of
the base; export as 3MF (not STL, which has no concept of separate
objects) to keep them individually selectable, movable and deletable
in your slicer. Both print flange-down, so neither needs supports.
Fixed: 3MF export stamped every file with the same placeholder date,
which at least one slicer rejected as invalid; it now uses the real
date.
Two new toolbar buttons (also in the right-click menu) for after
Generate makes several pieces at once: "Lay all flat" does Lay flat
for every separate piece in one click, picking each one's own
largest face; "Arrange on bed" spreads every piece out sideways so
none overlap, without changing how high up each one sits. (Both also
clear the faint "ghost" outlines left over from Generate, which used
to stay behind at their old spot once a piece moved; "Arrange on bed"
also now keeps the whole arrangement centred on the bed rather than
starting from a corner.)
Fixed: Lay all flat could flip an already-correctly-oriented piece
upside down, inconsistently - it measured a face's area without
allowing for any hole cut into it, so a cap with the shaft's hole
through it could wrongly tie with the solid underside.
The plug and rivet accessories now taper down from their wide
cap/head into the narrower shaft over a short cone, instead of an
abrupt step - a step that size is exactly the kind of weak point a
nearby purge/wipe move can snap a small part off at.
Browse parts now also lists boards from two KiCad libraries, including
several Espressif dev boards, alongside the existing Fritzing and Eagle
parts.
Ask AI: a tab in the Wiring window where you describe your project in
your own words and it suggests parts or writes the ESPHome code, with
a button to drop its answer straight into the ESPHome tab.
A cut-out that opens through a wall can ask for "Room behind it" (space
to reach screw terminals or a header row) or, with no hole at all, a
part can ask for "Extra room on an edge" - both without the box needing
to be a single exact size.
Boards on rails (no mounting holes) now get springy retention clips as
well as the end-stops, so they can't lift or slide sideways.
A Rugged-style box (which has a gasket groove in the rim) can also print
a matching TPU gasket ring straight from the wizard - tick "Also print a
TPU gasket for the groove", then switch to a flexible filament for that
one piece when you slice it.
Rotate (Q) now shows small orange arrows round the rotation circle as
soon as you click a face, pointing both ways until you start dragging,
then the way you're actually turning. It also snaps hard to 90/180/270/
360 degrees with a wide catch, and falls back to the usual every-15-
degrees snap in between.
New: "Build something new..." at the top. Describe a gadget in your own
words and your AI picks the parts, sets up the Enclosure Wizard and
writes the code - greets you with this the first time you open a new
file too (switch it off there if you'd rather not see it again). Saving
a file now keeps the Enclosure Wizard and Wiring/ESPHome answers with
it, so they come back when you open it on another computer; autosave
also now warns you plainly if the browser's storage fills up, instead
of silently falling behind.
Fixed: clicking "Generate base + lid" a second time could silently do
nothing at all, with no "replace the drawing?" prompt - some browsers
stop showing further prompts on a page after a few of them, which this
one had used up. The prompt is now one of EvenUCan's own windows,
not a browser prompt, so this can't happen again.
The Wiring window's code tab now says what it actually is ("Arduino
sketch (.ino)", "Python program (.py)"), not just "Code"; and if you
pick Arduino or Raspberry Pi, it offers a download link for the
software you'll need (the Arduino IDE, or VS Code for copying a
Python file onto a Pi) - the desktop program checks first and only
shows it if that program isn't already on your computer.
Fixed: "Build something new..." could match a water leak detector (or
anything else that "detects the presence" of something) to a PIR
motion sensor - the word "presence" on its own was too generic a
trigger for that part. Also added a proper water leak/level sensor
module, so these projects get matched correctly.
"Read a drawing" and "Look up online" (in Parts Library) now also fill
in a part's named pins (for Wiring), not just its mechanical sizes - if
a drawing shows a pinout, give it that and it reads the names,
positions and roles too. A real photo given to "Read a drawing" can
become the part's own picture as well, using the same corner-click
lineup as "Top photo...".
Fixed the photo lineup itself: the instruction to click the photo's
corners is now a dialog you have to dismiss, not an easy-to-miss line
of text; the small reference-picture thumbnail no longer sits on top
of where you need to click (it used to sit right over the top-right
corner); and it now has a close button instead of only zooming bigger
when clicked.
Fixed: a part with ports on two opposite edges (left and right, or
front and back) used to fail completely ("Couldn't fit the parts
together") rather than accept that one of them won't be flush. Now one
side sits properly flush and the other still gets its own hole cut
wherever it ends up, with a warning telling you the gap so you can
check a cable actually reaches. Ports on two adjacent edges (e.g. USB
and power on one side, another connector on the next side along, as on
a real Arduino UNO R4 WiFi) already worked fine - the box corner gives
both of them a true flush wall.
Fixed: a pin read from a drawing could never be recognised by Wiring as
a controller board's own pin, even when everything else about it was
read correctly - "gpio" (a general digital pin) is now one of the
roles the AI can use, alongside the sensor-style ones it already had.
Fixed a crash re-reading a drawing onto a part that had a pin selected
in its pin list.
Fixed: if "Read a drawing" or "Look up online" hit a genuine bug, the
message pointed the desktop app at the browser's F12 console - which
the desktop app has no way to open. It now has its own "Show error
details" button, so the error can always be seen and reported.
For a full illustrated guide, open "EvenUCan User Manual.pdf".


=====================================================================
 MAKING A BOX FOR YOUR ELECTRONICS
=====================================================================

WHAT IT DOES
  You tell EvenUCan which electronic bits you want to put in a box,
  such as a circuit board, a speaker or a battery. It designs a
  3D-printable box that fits them, with the right holes in the right
  places. You print the box, drop the parts in and close the lid.


---------------------------------------------------------------------
 STEP 1  -  Teach it your part
---------------------------------------------------------------------

The app needs to know two things about each part: HOW BIG it is, and
WHERE ITS IMPORTANT BITS ARE (the USB socket, the screw holes, a
microphone hole...). It already knows some common parts. For a new
one, you show it a photo.

  1. Measure the part with a ruler or calipers: its length, width and
     height, in millimetres.

  2. Take a photo looking straight down on it, like looking at it
     lying on a table. A plain background helps.

  3. Click "Parts" at the top, then "+ New part". Give it a name and
     type in the measurements.

  4. Click "Top photo..." and choose your picture.

  5. Click the four corners of the board, going round like a clock:
     top-left, top-right, bottom-right, bottom-left.
     If a corner is rounded, click where it WOULD be if it were square.
     The app straightens the photo and works out its scale, so it now
     knows exactly where everything on the board is.
     If the photo was taken the other way round (tall instead of wide),
     the app turns it to match. If it comes out upside down, click
     "Turn photo 180°".

  6. Mark the important bits. Click a button above the picture, then
     click on the photo:

       Port / socket .... A USB or power socket on the edge. The box
                          gets a hole there so you can plug a cable in.
       Mounting hole .... The box gets a little post with a screw hole
                          (or choose "Push-fit peg" instead: the board
                          drops onto a solid peg through its own hole).
       Mic sound hole ... The box gets a small hole so the microphone
                          can hear outside.
       Speaker cone ..... The box gets slots (a grille) so the sound
                          can get out.
       Round opening .... A round hole the part shows through, e.g. the
                          two "eyes" of an ultrasonic distance sensor,
                          an IR sensor or a camera lens. Set the part to
                          "Face against a wall" and it looks out through
                          the wall, held on standoffs. These have 45°
                          braces underneath, so they print without
                          supports.
       Button, LED,
       Display window ... The lid gets a hole so you can press it or
                          see it.
       Antenna .......... Other parts are kept away from it, so the
                          Wi-Fi works well.

     Drag a mark to move it. Click the red X next to it in the list to
     remove it.

  7. Click "Save part". It is now in your library, ready to use any time.

  Optional: "Side photo for heights..." measures how tall the part is
  from a photo taken from the side. Follow the instructions in the
  yellow bar above the picture.


---------------------------------------------------------------------
 FILL IN AUTOMATICALLY  (optional, uses the internet)
---------------------------------------------------------------------

Instead of measuring, EvenUCan can look a part up for you using an
AI. You'll find these buttons in the blue "Fill in automatically" box
at the top of the part's details in "Parts". Choose the AI there:

  Google Gemini (free):
    1. Click "Set up free AI key...", then OK with the box empty.
       Google AI Studio opens in your web browser.
    2. Sign in with a Google account and click "Create API key".
    3. Copy the key, click "Set up free AI key..." again and paste it.
    Free for everyday use, but it is sometimes busy and Google may
    change its free limits.

  Claude (paid, usually more reliable):
    1. Choose "Claude" in the AI box, click "Set up Claude key...", then
       OK with the box empty. The Anthropic Console opens
       (https://console.anthropic.com).
    2. Sign up or sign in, and add some credit under Billing.
    3. Go to Settings > API Keys, click "Create Key" and copy it.
    4. Click "Set up Claude key..." again and paste it.
    Each look-up uses a little of your credit (roughly US$0.10-0.40 for a
    web look-up, a few cents to read a drawing - an estimate).

  Keys are kept on this computer only and are never shared with parts
  you export.

  Look up online (the easy way):
    1. Click "+ New part", then "Look up online...".
    2. Type the exact part number, e.g. "MAX98357A breakout".
    3. The AI searches the web, opens the datasheet or product page and,
       within about a minute, fills in the sizes, holes and sockets as
       a DRAFT (pins come from "Import pins...", see WIRING below). The yellow bar lists anything it wasn't sure of
       and links to the pages it used.
    4. Product photos: if it found photos of the board, they appear as
       small pictures under the yellow bar. Click the best one (a straight
       view from above), then click the board's 4 corners in it, just like
       with your own photo. The photo then sits under the part's holes and
       sockets, so you can see at a glance whether they line up.
    5. Dimension drawings: the app also looks for dimension drawings
       (pictures of the board with measurements) on those pages, and for
       a datasheet PDF. If it finds one, the AI reads it automatically and
       its exact hole and socket positions replace the look-up's guesses,
       as long as the drawing's overall size matches. The drawing is
       shown in the top-right corner so you can check it.
       If the web search finds nothing, it asks the AI what it already
       knows about the part, and says so clearly. Measure those ones.
       If it can't fill anything in, click "Show AI reply" and take a
       screenshot: it shows exactly what the AI sent back.

  Read a drawing (when the look-up can't find it):
    1. Click "Search images myself..." (Google Images) or "Search the web
       myself..." to look for a dimension drawing (a picture with arrows
       and measurements). Both search for "<part> technical documentation
       schematic sizes", which finds the maker's drawings well. Save the
       drawing as a picture or PDF, or just copy it.
    2. Click "Read a drawing...", drag the file onto the part picture,
       or press Ctrl+V. The drawing is shown in the corner (click it to
       make it bigger) beside the draft.

  Either way: CHECK every number against the sources or the drawing,
  and your calipers if you can. Fix anything wrong, then "Save part".

  Good to know:
    - AI can misread drawings. Never print a box without checking.
    - Cheap modules often come in several versions with different hole
      positions. Make sure the drawing matches YOUR board.
    - Only the part number, or the drawing and the part's name and type,
      are sent to the AI you chose. On Google's free plan Google may use
      them to improve its products.
    - Without a key, everything else still works as normal.


---------------------------------------------------------------------
 STEP 2  -  Design the box
---------------------------------------------------------------------

  1. Click "Enclosure" at the top.

  2. Choose your parts from the list and click "Add".
     To take a part out again, click the red X on its row.

  3. Choose power:
       USB cable only, or
       Battery inside (the battery, a charging board and an on/off
       switch are added for you).

  4. Choose a style:
       Compact ..... The smallest neat box, for wires soldered in place.
       Prototype ... Extra room for push-on jumper wires while you're
                     still experimenting.
       Rugged ...... Thick 5 mm walls, a screw-down lid with a 3 mm
                     gasket groove, mounting ears, and 6 mm screw posts
                     with room for a screw or a heat-set brass insert.

  5. Choose a lid: push-on, click-on (snap) or screwed.

  The app works out the SMALLEST box that fits everything, following
  common-sense rules:
    - sockets go against a wall, so the hole lines up
    - the microphone faces out, kept away from the speaker
    - the battery sits next to its charger
    - nothing touches anything else

  You see a view from above. If you don't like where something went,
  DRAG it somewhere else ("Rotate part" turns it). The list underneath
  shows a green tick for things that are fine and a warning for
  anything that isn't. "Auto arrange" puts everything back.


---------------------------------------------------------------------
 STEP 3  -  Make it
---------------------------------------------------------------------

  1. Click "Generate base + lid". In about a second you get the box and
     its lid. The lid is turned over, ready to print. Faint outlines
     show where each part will sit inside (they are never printed).

  2. The app checks the design. You want to see "Ready to print".

  3. Click "Export 3MF" (or "Export STL"), open the file in your slicer
     (Cura, PrusaSlicer, Bambu Studio, OrcaSlicer...) and print it.
     The base and the lid come out as separate pieces, so you can
     print them one at a time.

  Tip: print the lid first, to check it fits snugly before printing
  the whole box.


IN ONE SENTENCE
  Measure it, photograph it, click the corners and the sockets, pick
  your parts, and the app designs and checks a printable box for you.


=====================================================================
 WIRING: WHAT WIRE GOES WHERE
=====================================================================

  Click "Wiring" at the top (or "Wiring..." in the Enclosure Wizard).
  For the parts in your box it works out:

    - which controller pin each part's signals go to. On the ESP32-S3
      it never uses the pins that would stop it working (start-up,
      USB, serial, PSRAM and LED pins).
    - the power: USB only, or battery -> charger -> switch -> the rest,
      with every ground joined.
    - warnings for anything risky, e.g. a 5 V signal into a 3.3 V pin
      (it tells you which resistors to add), or a speaker wire to GND.

  You get:
    - a picture: the controller in the middle with the other boards
      round it. Only the pins in use are labelled, outside the boards,
      and the labels never overlap. Wires are coloured by job: red for
      power (3.3 V, battery; 5 V is dashed), black for ground, and a
      colour of its own for each signal - the key is at the bottom.
      Click a line of the wiring list, a wire or a board to see just
      that one, with a big label such as "GPIO8 -> SDA (SSD1306 OLED)";
      "Show all" brings everything back. "One wire at a time" steps
      through the wires with Next and Back (or the arrow keys), in the
      same order as the list. Scroll the mouse wheel (or pinch) to
      zoom, drag the background to move about, "Fit" shows it all
      again, and drag a board to tidy the picture. "Save picture"
      saves the whole picture with every label.
    - a wiring list to tick off as you solder ("Save wiring list"
      saves it as a text file to print).
    - the matching pin settings for ESPHome and Arduino ("Code pins").

  Every part needs its pins. The built-in parts have them. For your
  own parts, open "Parts" and either add pins by hand at the bottom of
  the part's details, or click "Import pins...". It lists all the parts in the parts
  library that comes with EvenUCan to search, and it takes the pin
  names, their positions and the picture. You can also
  choose a .fzpz part file (a common format for electronics parts,
  free to download for many modules). Check each pin's role, and
  measure the board: these pictures keep the pin spacing exact but are
  sometimes drawn smaller than the real board.

  To find a part file, click "Search for a part file (.fzpz)..." in the
  blue "Fill in automatically" box: it searches the web for your
  board's name plus "fzpz". Someone may already have made one, with
  all the pins, the size and a picture. Download it and drag it onto
  the part picture (or use "Import pins..." > "Use a .fzpz file..."). A board drawn standing up is turned so its
  long side runs left to right. "Turn part 90°" (under the sizes in
  Parts) turns any part a quarter turn, with its picture, features and
  pins.

  ALWAYS check each connection against the labels printed on your
  boards before you power up.


=====================================================================
 COPY AND PASTE
=====================================================================

  Right-click in any box you can type in for Cut, Copy, Paste and
  Select All (Ctrl+X, Ctrl+C, Ctrl+V and Ctrl+A work too).


=====================================================================
 SHARING
=====================================================================

  Your drawings
    "Save" makes a .3mf file. Any slicer can print it, and it opens
    again in EvenUCan fully editable. Send it to anyone.

  Your parts
    Parts you add are saved on your own computer only. To give them to
    someone else: open "Parts", click "Export...", and send them the
    .json file. They click "Import..." in their copy.
    If your parts have photos, you can export with or without them.
    Photos downloaded from websites belong to whoever took them, so
    choose "Export without photos" when sharing with other people.

  Your work is also saved automatically as you go, and comes back the
  next time you open the program.


=====================================================================
 CREDITS
=====================================================================

  EvenUCan was created by David John Waugh.
  © 2026 David John Waugh.

  EvenUCan is free software: you can share it and change it under
  the terms of the GNU General Public License, version 3 or (at your
  option) any later version, published by the Free Software Foundation.
  It comes WITHOUT ANY WARRANTY. The full licence is in LICENSE.txt.
  Source code, downloads and bug reports:
  https://github.com/bullbrand/EvenUCan

  The enclosure designer uses the Manifold geometry library
  (© The Manifold Authors, Apache License 2.0), built into the program.
  The optional Claude look-up uses the Anthropic TypeScript SDK
  (© Anthropic, Apache License 2.0), also built in.
  The parts library that comes with EvenUCan (over 2,000 parts with
  their pins and pictures) is made from the Fritzing parts library,
  © Fritzing contributors, licensed under CC BY-SA 3.0
  (https://creativecommons.org/licenses/by-sa/3.0/). Parts made from it,
  or brought in with "Import pins...", keep that credit in their notes,
  and anyone sharing them must keep the credit and the same licence.

  Credits for the icons: most of the colourful button and menu icons
  come from FreeCAD (https://www.freecad.org,
  https://github.com/FreeCAD/FreeCAD), licensed under the GNU LGPL 2.1
  or later; a few of those files are marked CC BY-SA 4.0 or LGPL 3.0.
  They were cleaned and shrunk to fit inside the program. The rest
  (eraser, pan, zoom, lay all flat, box designer, parts library,
  wiring, code, AI key, picture, start a project, help and website)
  are original EvenUCan icons in the same style, under the GNU GPL v3
  or later. The full list of every icon and where it came from is in
  THIRD-PARTY-NOTICES.txt.
