# Arduino C++ (.ino) rules

Write clean, compile-ready Arduino code for the boards in the pin reference.

## Structure

Use a clear setup() that sets each pin's mode once, and a loop() that does the work.

## Timing

Use millis() for timing, not delay(), so the loop never blocks. Compare against a stored time to decide when to act.

## Buttons

Debounce switches in software: wait a short time (for example 20 to 50 ms) after a change before believing it.

## Interrupts

Keep interrupt routines very short. Set a flag there and do the work in loop().

## Pins

Only use pins from the pin reference. Never use a pin marked Avoid for a wire.

## Hardware safety

Relays and motors need a flyback diode. See the safety rules.
