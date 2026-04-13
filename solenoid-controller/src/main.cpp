#include <Arduino.h>
#include <Adafruit_NeoPixel.h>

#define LED_PIN 8
#define NUM_LEDS 1
#define SERIAL_BUFFER_SIZE 4 // messages are "d:d"
#define END_MARKER '\n'

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);
char serial_buffer[SERIAL_BUFFER_SIZE];
int bytesRead = 0;

bool handleMessage(const char *msg)
{
  const char *colon = strchr(msg, ':');
  if (colon == nullptr)
  {
    return false;
  }

  int id = atoi(msg);
  int value = atoi(colon + 1);

  if (value == 1)
  {
    strip.setPixelColor(0, strip.Color(255, 0, 0));
  }
  else
  {
    strip.clear();
  }
  strip.show();

  return true;
}

void setup()
{
  Serial.begin(9600);
  strip.begin();
  strip.show();
}

void loop()
{
  while (Serial.available() > 0)
  {
    char received = Serial.read();
    if (received == END_MARKER)
    {
      serial_buffer[bytesRead] = '\0';
      Serial.print("ACK ");
      Serial.println(serial_buffer);
      handleMessage(serial_buffer);
      memset(serial_buffer, 0, sizeof(serial_buffer));
      bytesRead = 0;
      return;
    }
    serial_buffer[bytesRead] = received;
    bytesRead++;
    if (bytesRead >= SERIAL_BUFFER_SIZE)
    {
      serial_buffer[SERIAL_BUFFER_SIZE - 1] = '\0';
      bytesRead = 0;
      break;
    }
  }
}
