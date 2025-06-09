#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// Pines del DHT y relés
#define DHTPIN 27
#define DHTTYPE DHT11
#define RELEM1 26  // Ventilador 1
#define RELEM2 14  // Ventilador 2
#define RELEM3 13  // Ventilador 3

// Datos de red Wi-Fi
const char* ssid = "Pepo";
const char* password = "tasha2222";

// Endpoint del servidor backend
const char* serverName = "https://esp32-test-kdfg.onrender.com/sensor-data";
const char* fanEventsEndpoint = "https://esp32-test-kdfg.onrender.com/fan-events";

// Inicializar sensor DHT
DHT dht(DHTPIN, DHTTYPE);

// Variables para tracking del estado de ventiladores
bool lastFan1State = true;  // HIGH = apagado
bool lastFan2State = true;
bool lastFan3State = true;

void setup() {
  Serial.begin(115200);
  Serial.println("Iniciando sistema...");

  // Iniciar sensor
  dht.begin();

  // Configurar pines como salidas
  pinMode(RELEM1, OUTPUT);
  pinMode(RELEM2, OUTPUT);
  pinMode(RELEM3, OUTPUT);

  // Apagar todos los ventiladores por defecto (relé activo en LOW)
  digitalWrite(RELEM1, HIGH);
  digitalWrite(RELEM2, HIGH);
  digitalWrite(RELEM3, HIGH);

  // Conectar a WiFi
  WiFi.begin(ssid, password);
  Serial.print("Conectando a WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.print(".");
  }
  Serial.println(" ¡Conectado!");
}

void sendFanEvent(bool fan1, bool fan2, bool fan3, float temp, String description) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(fanEventsEndpoint);
    http.addHeader("Content-Type", "application/json");

    // Crear JSON para evento de ventiladores (invertir lógica: LOW = encendido)
    String json = "{\"ventilador1\":" + String(!fan1 ? "true" : "false") + 
                  ",\"ventilador2\":" + String(!fan2 ? "true" : "false") + 
                  ",\"ventilador3\":" + String(!fan3 ? "true" : "false") + 
                  ",\"temperatura\":" + String(temp, 2) + 
                  ",\"evento_descripcion\":\"" + description + "\"}";
    
    int httpResponseCode = http.POST(json);
    
    if (httpResponseCode > 0) {
      Serial.println("Evento de ventiladores enviado: " + description);
    } else {
      Serial.println("Error enviando evento de ventiladores");
    }
    
    http.end();
  }
}

void loop() {
  // Leer temperatura y humedad
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  // Validar lectura
  if (isnan(h) || isnan(t)) {
    Serial.println("❌ Error al leer el sensor DHT!");
    delay(5000);
    return;
  }

  // Mostrar datos por consola
  Serial.printf("Humedad: %.2f%%  Temperatura: %.2f°C\n", h, t);

  // Control de ventiladores
  bool currentFan1State, currentFan2State, currentFan3State;
  String eventDescription = "";

  if (t < 26) {
    currentFan1State = HIGH;
    currentFan2State = HIGH;
    currentFan3State = HIGH;
    eventDescription = "Todos los ventiladores APAGADOS";

  } else if (t >= 26 && t <= 28) {
    currentFan1State = LOW;
    currentFan2State = HIGH;
    currentFan3State = HIGH;
    eventDescription = "Ventilador 1 ENCENDIDO";

  } else if (t > 28 && t <= 30) {
    currentFan1State = LOW;
    currentFan2State = LOW;
    currentFan3State = HIGH;
    eventDescription = "Ventiladores 1 y 2 ENCENDIDOS";

  } else if (t > 30) {
    currentFan1State = LOW;
    currentFan2State = LOW;
    currentFan3State = LOW;
    eventDescription = "Todos los ventiladores ENCENDIDOS";
  }

  // Verificar si hubo cambio en el estado de los ventiladores
  bool stateChanged = (currentFan1State != lastFan1State) || 
                     (currentFan2State != lastFan2State) || 
                     (currentFan3State != lastFan3State);

  // Aplicar estados a los relés
  digitalWrite(RELEM1, currentFan1State);
  digitalWrite(RELEM2, currentFan2State);
  digitalWrite(RELEM3, currentFan3State);
  
  Serial.println(eventDescription);

  // Si hubo cambio de estado, enviar evento
  if (stateChanged) {
    sendFanEvent(currentFan1State, currentFan2State, currentFan3State, t, eventDescription);
    
    // Actualizar estados anteriores
    lastFan1State = currentFan1State;
    lastFan2State = currentFan2State;
    lastFan3State = currentFan3State;
  }

  // Enviar datos al servidor
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    // Crear JSON
    String json = "{\"temperatura\":" + String(t, 2) + ",\"humedad\":" + String(h, 2) + "}";
    int httpResponseCode = http.POST(json);

    Serial.print("Respuesta HTTP: ");
    Serial.println(httpResponseCode);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Respuesta del servidor: " + response);
    } else {
      Serial.println("Error en la petición HTTP");
    }

    http.end();
  } else {
    Serial.println("WiFi no conectado");
  }

  delay(10000);  // Esperar 10 segundos antes de la siguiente lectura
}
