const products = require('./data/products');
const { getAIResponse } = require('./llm_handler');
const { extractPaymentData } = require('./vision_handler');
const { MessageMedia } = require('whatsapp-web.js');
require('dotenv').config();

const ADMIN_WA_NUMBER = process.env.ADMIN_WA_NUMBER;

// State management
const userSessions = new Map();

const SESSION_TIMEOUT = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

// State names
const STATE = {
  INIT: 'INIT',
  CATEGORY: 'CATEGORY',
  ESIM_PLANS: 'ESIM_PLANS',
  HOSTING_PLANS: 'HOSTING_PLANS',
  AWAITING_PAYMENT_SCREENSHOT: 'AWAITING_PAYMENT_SCREENSHOT',
  PROCESSING_PAYMENT: 'PROCESSING_PAYMENT',
  COMPLETED: 'COMPLETED'
};

function getOrCreateSession(userId) {
  const now = new Date();

  if (userSessions.has(userId)) {
    const session = userSessions.get(userId);

    // Check if session expired
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      userSessions.set(userId, {
        state: STATE.INIT,
        selectedProduct: null,
        history: [],
        lastActivity: now
      });
    }

    return userSessions.get(userId);
  }

  const newSession = {
    state: STATE.INIT,
    selectedProduct: null,
    history: [],
    lastActivity: now
  };

  userSessions.set(userId, newSession);
  return newSession;
}

// Message formatters
function formatESIMMenu() {
  const esim = products.esim;
  let message = `*${esim.label}*\n${esim.tagline}\n\n`;

  esim.plans.forEach((plan, index) => {
    const recommended = plan.recommended ? ' ⭐ Most Popular' : '';
    message += `${index + 1}. *${plan.name}* - Rs ${plan.price}${recommended}\n`;
  });

  message += '\nReply with the plan number (1, 2, or 3) or name to continue.';
  return message;
}

function formatHostingMenu() {
  const hosting = products.hosting;
  let message = `*${hosting.label}*\n${hosting.tagline}\n\n*Features:*\n`;

  hosting.features.forEach(feature => {
    message += `✓ ${feature}\n`;
  });

  message += '\n*Plans:*\n';
  hosting.plans.forEach((plan, index) => {
    message += `${index + 1}. *${plan.name}* - Rs ${plan.price}\n`;
  });

  message += '\nReply with the plan number (1, 2, or 3) or name to continue.';
  return message;
}

function formatPaymentDetails(selectedPlan) {
  const payment = products.payment;
  let message = `*Order Summary*\n📦 ${selectedPlan.category.label}\n`;
  message += `Plan: ${selectedPlan.plan.name}\n`;
  message += `Amount: *Rs ${selectedPlan.plan.price}*\n\n`;
  message += `*Payment Methods:*\n`;

  payment.methods.forEach((method, index) => {
    message += `${index + 1}. *${method.name}*\n`;
    message += `   Number: ${method.number}\n`;
    message += `   Account: ${method.accountName}\n\n`;
  });

  message += `Please send Rs ${selectedPlan.plan.price} to any of the above accounts, then share the payment screenshot here.`;
  return message;
}

function formatAdminNotification(customerWAID, selectedProduct, geminiData) {
  return `*NEW ORDER — SimFly Pakistan*

Customer: ${customerWAID}
Product: ${selectedProduct.plan.name} - Rs ${selectedProduct.plan.price}
Amount Due: Rs ${selectedProduct.plan.price}

*AI Payment Verification:*
• Amount Extracted: Rs ${geminiData.amount || 'N/A'}
• Sender Name: ${geminiData.sender_name || 'N/A'}
• Time: ${geminiData.transaction_time || 'N/A'}
• Transaction ID: ${geminiData.transaction_id || 'N/A'}
• Method: ${geminiData.payment_method || 'N/A'}

Please verify and fulfill the order.`;
}

// Main message handler
async function handleMessage(client, message) {
  try {
    // Ignore messages from groups
    if (message.from.includes('@g.us')) {
      return;
    }

    // Ignore messages from the bot itself
    if (message.fromMe === true) {
      return;
    }

    const userId = message.from;
    const session = getOrCreateSession(userId);
    const now = new Date();

    // Update last activity
    session.lastActivity = now;

    const messageText = message.body?.toLowerCase() || '';

    // Route based on state
    switch (session.state) {
      case STATE.INIT:
        // Add user message to history
        session.history.push({ role: 'user', content: message.body });

        // Get AI response with system note
        const systemNote = "The customer just started a conversation. Greet them warmly, introduce SimFly Pakistan, mention that eSIMs are perfect for Non-PTA phones, then ask if they're interested in eSIMs or Web Hosting.";
        const initResponse = await getAIResponse([
          ...session.history,
          { role: 'system', content: systemNote }
        ]);

        session.history.push({ role: 'assistant', content: initResponse });
        await client.sendMessage(userId, initResponse);
        session.state = STATE.CATEGORY;
        break;

      case STATE.CATEGORY:
        // Detect eSIM interest
        if (messageText.includes('esim') || messageText.includes('sim') ||
            messageText.includes('internet') || messageText.includes('data') ||
            messageText === '1' || messageText.includes('e-sim')) {
          session.state = STATE.ESIM_PLANS;
          await client.sendMessage(userId, formatESIMMenu());
        }
        // Detect hosting interest
        else if (messageText.includes('hosting') || messageText.includes('website') ||
                 messageText.includes('web') || messageText === '2') {
          session.state = STATE.HOSTING_PLANS;
          await client.sendMessage(userId, formatHostingMenu());
        }
        // Otherwise, let AI guide them back
        else {
          session.history.push({ role: 'user', content: message.body });
          const categoryResponse = await getAIResponse([
            ...session.history,
            { role: 'system', content: 'The customer has not selected a category. Guide them to choose either eSIM (for data plans) or Web Hosting.' }
          ]);
          session.history.push({ role: 'assistant', content: categoryResponse });
          await client.sendMessage(userId, categoryResponse);
        }
        break;

      case STATE.ESIM_PLANS:
        // Detect plan selection
        let esimPlan = null;

        if (messageText.includes('500') || messageText.includes('500mb') || messageText === '1') {
          esimPlan = products.esim.plans[0];
        } else if (messageText.includes('1gb') || messageText === '2' || messageText.includes('1 gb')) {
          esimPlan = products.esim.plans[1];
        } else if (messageText.includes('5gb') || messageText === '3' || messageText.includes('5 gb')) {
          esimPlan = products.esim.plans[2];
        }

        if (esimPlan) {
          session.selectedProduct = {
            category: products.esim,
            plan: esimPlan
          };
          await client.sendMessage(userId, formatPaymentDetails(session.selectedProduct));
          session.state = STATE.AWAITING_PAYMENT_SCREENSHOT;
        } else {
          // Use AI to respond if unclear
          session.history.push({ role: 'user', content: message.body });
          const esimResponse = await getAIResponse([
            ...session.history,
            { role: 'system', content: 'The customer is selecting an eSIM plan. Available plans: 500MB (Rs 150), 1GB (Rs 350) - recommended, 5GB (Rs 1300). Guide them to select one.' }
          ]);
          session.history.push({ role: 'assistant', content: esimResponse });
          await client.sendMessage(userId, esimResponse);
        }
        break;

      case STATE.HOSTING_PLANS:
        // Detect plan selection
        let hostingPlan = null;

        if (messageText.includes('1 year') || messageText.includes('1-year') || messageText === '1') {
          hostingPlan = products.hosting.plans[0];
        } else if (messageText.includes('2 year') || messageText.includes('2-year') || messageText === '2') {
          hostingPlan = products.hosting.plans[1];
        } else if (messageText.includes('4 year') || messageText.includes('4-year') || messageText === '3') {
          hostingPlan = products.hosting.plans[2];
        }

        if (hostingPlan) {
          session.selectedProduct = {
            category: products.hosting,
            plan: hostingPlan
          };
          await client.sendMessage(userId, formatPaymentDetails(session.selectedProduct));
          session.state = STATE.AWAITING_PAYMENT_SCREENSHOT;
        } else {
          // Use AI to respond if unclear
          session.history.push({ role: 'user', content: message.body });
          const hostingResponse = await getAIResponse([
            ...session.history,
            { role: 'system', content: 'The customer is selecting a hosting plan. Available plans: 1-Year (Rs 4000), 2-Year (Rs 13000), 4-Year (Rs 22000). Guide them to select one.' }
          ]);
          session.history.push({ role: 'assistant', content: hostingResponse });
          await client.sendMessage(userId, hostingResponse);
        }
        break;

      case STATE.AWAITING_PAYMENT_SCREENSHOT:
        if (message.hasMedia === true) {
          session.state = STATE.PROCESSING_PAYMENT;

          try {
            const media = await message.downloadMedia();

            if (!media) {
              await client.sendMessage(userId, "Sorry, I couldn't download the image. Please try sending it again.");
              session.state = STATE.AWAITING_PAYMENT_SCREENSHOT;
              break;
            }

            await client.sendMessage(userId, "📸 Screenshot received! Verifying your payment, please wait a moment...");

            // Process with Gemini
            const geminiData = await extractPaymentData(Buffer.from(media.data, 'base64'), media.mimetype);

            // Build and send admin notification
            const adminNotification = formatAdminNotification(userId, session.selectedProduct, geminiData);

            // Send text notification to admin
            await client.sendMessage(ADMIN_WA_NUMBER, adminNotification);

            // Forward original image to admin
            const adminMedia = new MessageMedia(media.mimetype, media.data, media.filename || 'payment.png');
            await client.sendMessage(ADMIN_WA_NUMBER, adminMedia);

            // Confirm to customer
            await client.sendMessage(userId, "✅ Your order has been received! Our team will activate your service shortly. For any queries reply with 'help'.");

            session.state = STATE.COMPLETED;
          } catch (err) {
            console.error('Payment processing error:', err);
            await client.sendMessage(userId, "Sorry, I couldn't process the image. Please send the payment screenshot again.");
            await client.sendMessage(ADMIN_WA_NUMBER, `AI verification failed for customer ${userId}. Please verify manually.`);

            // Try to forward the image anyway if we have it
            try {
              const media = await message.downloadMedia();
              if (media) {
                const adminMedia = new MessageMedia(media.mimetype, media.data, media.filename || 'payment.png');
                await client.sendMessage(ADMIN_WA_NUMBER, `Failed verification image from ${userId}:`);
                await client.sendMessage(ADMIN_WA_NUMBER, adminMedia);
              }
            } catch (forwardErr) {
              console.error('Failed to forward image:', forwardErr);
            }

            session.state = STATE.AWAITING_PAYMENT_SCREENSHOT;
          }
        } else {
          // Remind them to send screenshot
          await client.sendMessage(userId, "Please send the payment screenshot so we can verify your order. If you need help, reply with 'help'.");
        }
        break;

      case STATE.COMPLETED:
        if (messageText === 'help') {
          // Reset to INIT
          session.state = STATE.INIT;
          session.history = [];
          session.selectedProduct = null;

          const helpResponse = await getAIResponse([
            { role: 'system', content: 'The customer needs help. Provide a warm greeting and ask how we can assist them today.' },
            { role: 'user', content: 'help' }
          ]);
          await client.sendMessage(userId, helpResponse);
        } else {
          await client.sendMessage(userId, "Your order has been received! Our team will activate your service shortly. For any queries reply with 'help'.");
        }
        break;

      default:
        await client.sendMessage(userId, "Welcome to SimFly Pakistan! How can we help you today?");
        session.state = STATE.INIT;
    }
  } catch (err) {
    console.error('handleMessage error:', err);
    // Don't throw - keep the bot running
  }
}

module.exports = { handleMessage };
