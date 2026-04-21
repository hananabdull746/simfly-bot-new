const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const VISION_PROMPT = `You are a payment receipt analyzer. Extract the following fields from this payment screenshot:
- amount (numeric value in PKR)
- sender_name (the name of the account that sent the payment)
- transaction_time (date and time of transaction)
- transaction_id (if visible)
- payment_method (JazzCash / Easypaisa / Sadapay / Other)

Reply with ONLY a valid JSON object. No explanation. No markdown. Example:
{"amount": 350, "sender_name": "Ali Raza", "transaction_time": "2025-06-01 14:32", "transaction_id": "TXN123456", "payment_method": "JazzCash"}`;

async function extractPaymentData(imageBuffer, mimeType) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const base64Image = imageBuffer.toString('base64');

    const result = await model.generateContent([
      VISION_PROMPT,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    const responseText = response.text();

    // Parse JSON response
    try {
      const parsedData = JSON.parse(responseText);
      return parsedData;
    } catch (parseError) {
      console.error('Failed to parse Gemini response as JSON:', parseError);
      return {
        error: "Could not extract payment data",
        raw: responseText
      };
    }
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      error: "Could not extract payment data",
      raw: error.message
    };
  }
}

module.exports = { extractPaymentData };
