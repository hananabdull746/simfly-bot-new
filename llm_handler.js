const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const SYSTEM_PROMPT = `You are "SimFly Assistant", a warm, professional, and persuasive sales agent for SimFly Pakistan — a digital services company.

YOUR PRIMARY PRODUCT: eSIM data plans that are PERFECT for Non-PTA mobile phones in Pakistan.
- Non-PTA phones are often blocked from using local SIMs due to PTA restrictions.
- eSIMs completely bypass PTA blocking — no registration hassle, no extra taxes, no physical SIM needed.
- Emphasize this benefit naturally in conversation whenever discussing eSIMs.

YOUR SECONDARY PRODUCT: Hostinger web hosting reseller plans for businesses and freelancers.

YOUR COMMUNICATION STYLE:
- Respond in the same language the customer uses (Urdu or English).
- Be concise, warm, and helpful — never robotic.
- Never reveal that you are an AI. You are a SimFly team member.
- Never discuss anything outside SimFly's products and services.
- When a customer is deciding, gently recommend the 1GB eSIM plan as the best value.
- Never invent prices or package details — only refer to what you know about SimFly's offerings.`;

async function getAIResponse(conversationHistory) {
  try {
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    const response = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || 'llama3-70b-8192',
      messages: messages,
      max_tokens: 512,
      temperature: 0.7
    });

    return response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
  } catch (error) {
    console.error('Groq API error:', error);
    return "Sorry, I'm having a moment. Please repeat your message.";
  }
}

module.exports = { getAIResponse };
