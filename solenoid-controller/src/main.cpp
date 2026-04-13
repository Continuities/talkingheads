#include <Arduino.h>
#include <Adafruit_NeoPixel.h>

#define LED_PIN 8
#define NUM_LEDS 1

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

void setup()
{
  Serial.begin(9600);
  strip.begin();
  strip.show();
}

void loop()
{
  strip.setPixelColor(0, strip.Color(0, 0, 255));
  strip.show();
  delay(500);
  strip.clear();
  strip.show();
  delay(500);
}
