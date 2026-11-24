# ESPHome YAML rules

Write ESPHome YAML that is valid and uses only components that exist in ESPHome.

## Actuators

Every relay or other actuator needs restore_mode: ALWAYS_OFF, so it stays off after a reboot.

## Lambdas

Use lambda filters for simple conversions on sensor values. Keep each lambda short.

## Automations

Use the standard triggers: on_press, on_value and interval. Use actions inside them, not guesses about syntax.

## Pins

Only use pins from the pin reference. Never use a pin marked Avoid for a wire.

## Output

Give complete, compile-ready YAML in one code block, with the board name and the pin for each part.
