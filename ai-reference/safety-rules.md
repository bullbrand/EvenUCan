# Electrical safety rules

These rules come first in every wiring answer. Keep the advice short and plain.

## Inductive loads need a flyback diode

Relays, DC motors, pumps, solenoids and coils all need a flyback diode across them. Use a 1N4007 (or similar) with the stripe toward the positive supply. Without it, the switching spike can damage the microcontroller pin or the driver.

## Level shifting from 5V to 3.3V

ESP32, ESP32-S3, ESP32-C3, ESP8266 and RP2040 boards are 3.3V logic. Do not feed 5V signals straight into their pins. Use a logic level shifter or a resistor divider.

## Common ground

Connect all the grounds together at one point (star grounding), so that signals and power share a reference.

## Fuse the power

Put an inline fuse on the DC power feed, sized for the load, so a short cannot overheat the wiring.

## Decouple the power supply

Put decoupling capacitors close to the microcontroller's power pins to keep the supply steady.

## Actuators start OFF

Relays and other actuators must not switch on at power-up. In ESPHome, set restore_mode to ALWAYS_OFF on them.
