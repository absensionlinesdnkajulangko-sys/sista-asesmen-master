import { SoalFormData, GeneratedSoal } from "../types";

export async function generateSoal(data: SoalFormData): Promise<GeneratedSoal> {
  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Client API Error:", error);
    throw error;
  }
}
