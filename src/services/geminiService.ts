import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface ForecastInput {
  city: string;
  timestamp: string;
  isWeekend: boolean;
  isHoliday: boolean;
  temp: number;
  humidity: number;
  trafficIndex: number;
  solarRadiation: number;
  historicalContext?: string; // CSV-like string of recent data points
}

export interface ForecastDataPoint {
  time: string;
  demand: number;
  production: number;
}

export interface CityStanding {
  name: string;
  renewableFulfillment: number; // percentage
  demandMW: number;
  renewableMW: number;
}

export interface ForecastOutput {
  predictedDemandMW: number;
  predictedRenewableMW: number;
  batteryStoragePercent: number;
  forecast1h: ForecastDataPoint[];
  forecast24h: ForecastDataPoint[];
  forecast7d: ForecastDataPoint[];
  zoneWiseDemand: {
    airport: number;
    downtown: number;
    suburbs: number;
  };
  renewableOutput: {
    solar: number;
    wind: number;
    hydro: number;
    gridImport: number;
  };
  evCharging: {
    currentLoadMW: number;
    optimalWindow: string;
  };
  weatherImpact: {
    temperature: number;
    trend: string; // e.g., "+2°C" or "-1°C"
    alert: string;
    riskLevel: "Low" | "Medium" | "High";
    operatorNote: string;
  };
  balance: number; // Surplus or Deficit
  alerts: string[];
  suggestions: string[];
  metrics: {
    renewableUsagePercent: number;
    co2AvoidedTons: number;
    efficiencyScore: number;
  };
  solutions: string[];
  predictionDetails: {
    confidenceLevel: number; // 0-100
    lowerBoundMW: number;
    upperBoundMW: number;
    errorMarginPercent: number;
    dataQualityScore: number; // 0-100
  };
  standings: CityStanding[];
}

export async function getEnergyForecast(input: ForecastInput): Promise<ForecastOutput> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is missing. Using simulated data.");
    throw new Error("API_KEY_MISSING");
  }

  const prompt = `
    Act as an AI Energy Demand and Renewable Production Forecaster for a Smart City in India.
    
    Current Context:
    - City: ${input.city}
    - Target Time: ${input.timestamp}
    - Is Weekend: ${input.isWeekend}
    - Is Holiday: ${input.isHoliday}
    - Temperature: ${input.temp}°C
    - Humidity: ${input.humidity}%
    - Traffic Index: ${input.trafficIndex}
    - Solar Radiation: ${input.solarRadiation} W/m²

    Historical Data (Recent Trends - Hourly):
    ${input.historicalContext || "No historical data provided."}

    Based on the historical trends provided (which show the last 48 hours of grid behavior) and the current environmental parameters, generate a high-fidelity energy forecast:
    1. A single forecast for the EXACT current time: ${input.timestamp}.
    2. Three forecast series for both demand and renewable production:
       - forecast1h: A 1-hour forecast (one point every 5 minutes, 12 points total) starting from the current time. Use "HH:MM" format. This should show short-term fluctuations.
       - forecast24h: A 24-hour forecast (one point every 2 hours, 12 points total) starting from the current hour. Use "HH:MM" format. This must reflect the daily load curve (peaks in evening/morning) and solar cycle (peak at noon).
       - forecast7d: A 7-day forecast (one point per day, 7 points total) starting from today. Use "MMM DD" format (e.g., "Mar 12"). This should account for weekend vs weekday differences.
    3. Battery storage percentage (0-100) based on current surplus/deficit trends.
    4. Zone-wise demand for specific zones (Airport, Downtown, Suburbs) representing the TOTAL predicted energy need (MW) for each sector over the next 24 hours.
    5. Weather impact analysis:
       - temperature: A realistic temperature for the city at the target time.
       - trend: Temperature trend (e.g., "+2°C").
       - alert: A brief alert message.
       - riskLevel: "Low", "Medium", or "High".
       - operatorNote: Mention any specific spikes or grid risks due to weather that the grid operator should look out for (e.g., "Heatwave expected: peak demand surge at 14:00 due to AC load").
    6. Energy Mix Breakdown (Solar, Wind, Hydro, Grid Import) representing the total predicted generation/import (MW) for each source over the next 24 hours.
    7. Standings for exactly these 5 cities: Amaravati, Hyderabad, New Delhi, Kochi, and Thiruvananthapuram. For each city, provide:
       - name: City name.
       - renewableFulfillment: Percentage of current demand fulfilled by renewable sources (0-100).
       - demandMW: Current demand in MW.
       - renewableMW: Current renewable production in MW.
    8. Metrics including CO2 avoided and efficiency score.
    9. Solutions and suggestions for grid optimization.

    CRITICAL: 
    - The forecasts MUST be consistent with the provided Historical Data. If the last recorded demand was 5000MW, the forecast should start near that value.
    - Identify daily patterns (e.g., demand drops at night, peaks at 7 PM).
    - Identify solar patterns (production starts at 6 AM, peaks at 12 PM, ends at 6 PM).
    - Ensure "Grid Import" balances the load when renewables are low.
    - All data must be highly realistic for the specific city and the current time of day. 
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            predictedDemandMW: { type: Type.NUMBER },
            predictedRenewableMW: { type: Type.NUMBER },
            batteryStoragePercent: { type: Type.NUMBER },
            forecast1h: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  demand: { type: Type.NUMBER },
                  production: { type: Type.NUMBER },
                },
                required: ["time", "demand", "production"],
              },
            },
            forecast24h: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  demand: { type: Type.NUMBER },
                  production: { type: Type.NUMBER },
                },
                required: ["time", "demand", "production"],
              },
            },
            forecast7d: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  demand: { type: Type.NUMBER },
                  production: { type: Type.NUMBER },
                },
                required: ["time", "demand", "production"],
              },
            },
            zoneWiseDemand: {
              type: Type.OBJECT,
              properties: {
                airport: { type: Type.NUMBER },
                downtown: { type: Type.NUMBER },
                suburbs: { type: Type.NUMBER },
              },
              required: ["airport", "downtown", "suburbs"],
            },
            renewableOutput: {
              type: Type.OBJECT,
              properties: {
                solar: { type: Type.NUMBER },
                wind: { type: Type.NUMBER },
                hydro: { type: Type.NUMBER },
                gridImport: { type: Type.NUMBER },
              },
              required: ["solar", "wind", "hydro", "gridImport"],
            },
            evCharging: {
              type: Type.OBJECT,
              properties: {
                currentLoadMW: { type: Type.NUMBER },
                optimalWindow: { type: Type.STRING },
              },
              required: ["currentLoadMW", "optimalWindow"],
            },
            weatherImpact: {
              type: Type.OBJECT,
              properties: {
                temperature: { type: Type.NUMBER },
                trend: { type: Type.STRING },
                alert: { type: Type.STRING },
                riskLevel: { type: Type.STRING },
                operatorNote: { type: Type.STRING },
              },
              required: ["temperature", "trend", "alert", "riskLevel", "operatorNote"],
            },
            balance: { type: Type.NUMBER },
            alerts: { type: Type.ARRAY, items: { type: Type.STRING } },
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            metrics: {
              type: Type.OBJECT,
              properties: {
                renewableUsagePercent: { type: Type.NUMBER },
                co2AvoidedTons: { type: Type.NUMBER },
                efficiencyScore: { type: Type.NUMBER },
              },
              required: ["renewableUsagePercent", "co2AvoidedTons", "efficiencyScore"],
            },
            solutions: { type: Type.ARRAY, items: { type: Type.STRING } },
            predictionDetails: {
              type: Type.OBJECT,
              properties: {
                confidenceLevel: { type: Type.NUMBER },
                lowerBoundMW: { type: Type.NUMBER },
                upperBoundMW: { type: Type.NUMBER },
                errorMarginPercent: { type: Type.NUMBER },
                dataQualityScore: { type: Type.NUMBER },
              },
              required: ["confidenceLevel", "lowerBoundMW", "upperBoundMW", "errorMarginPercent", "dataQualityScore"],
            },
            standings: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  renewableFulfillment: { type: Type.NUMBER },
                  demandMW: { type: Type.NUMBER },
                  renewableMW: { type: Type.NUMBER },
                },
                required: ["name", "renewableFulfillment", "demandMW", "renewableMW"],
              },
            },
          },
          required: [
            "predictedDemandMW",
            "predictedRenewableMW",
            "batteryStoragePercent",
            "forecast1h",
            "forecast24h",
            "forecast7d",
            "zoneWiseDemand",
            "renewableOutput",
            "evCharging",
            "weatherImpact",
            "balance",
            "alerts",
            "suggestions",
            "metrics",
            "solutions",
            "predictionDetails",
            "standings",
          ],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}

export async function getChatResponse(
  message: string,
  history: { role: "user" | "ai"; content: string }[],
  context: {
    city: string | null;
    forecast: ForecastOutput | null;
    historicalData?: any[];
  }
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    return "I'm sorry, my neural link is currently offline (API Key missing). Please check your configuration.";
  }

  const systemInstruction = `
    You are Lumino AI, an advanced energy intelligence assistant for Indian Smart Cities.
    
    Current Context:
    - Selected City: ${context.city || "None"}
    - Current Forecast: ${context.forecast ? JSON.stringify(context.forecast) : "No forecast data available yet."}
    - Historical Data (last few records): ${context.historicalData ? JSON.stringify(context.historicalData.slice(-10)) : "No historical data available."}
    
    Your Task:
    - Answer user questions about energy demand, renewable production, and sustainability for the selected city.
    - Use the provided forecast and historical data to give specific, data-driven answers.
    - Analyze trends between historical data and the current forecast if asked.
    - If the user asks about something you don't have data for, or if no city is selected, politely explain that you need a city selection or more data to answer accurately.
    - If you absolutely cannot find an answer within the program's data or context, return exactly: "I am not able to fetch the required answer."
    - Keep responses concise, professional, and helpful.
    - Use Markdown for formatting if needed.
  `;

  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction,
      },
    });

    // Convert history to Gemini format
    // Note: Gemini expects 'user' and 'model' roles.
    // We'll skip the very first message if it's the default AI greeting to keep it clean.
    const formattedHistory = history.slice(1).map(msg => ({
      role: msg.role === "user" ? "user" : "model" as any,
      parts: [{ text: msg.content }]
    }));

    const response = await chat.sendMessage({
      message,
    });

    return response.text || "I am not able to fetch the required answer.";
  } catch (error) {
    console.error("Chat Error:", error);
    return "I am not able to fetch the required answer.";
  }
}
