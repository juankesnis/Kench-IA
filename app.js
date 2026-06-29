/* Claves API configuradas por defecto (Inyectadas de forma segura en CI/CD) */
const GEMINI_KEY = "GEMINI_API_KEY_PLACEHOLDER";
const OPENAI_KEY = "OPENAI_API_KEY_PLACEHOLDER";
const GROQ_KEY = "GROQ_API_KEY_PLACEHOLDER";

// Elementos del DOM
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const modelSelector = document.getElementById('model-selector');

let chatHistory = [];
let recognition;
let isRecording = false;

// Inicializar Reconocimiento de Voz nativa móvil
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = 'es-ES';
  recognition.continuous = false; // Detener cuando hay una pausa (mejor para móvil)

  recognition.onstart = () => {
    isRecording = true;
    micBtn.style.background = 'rgba(239, 68, 68, 0.2)';
    micBtn.style.color = '#ef4444';
    chatInput.placeholder = 'Escuchando tu voz...';
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    chatInput.value = text;
  };

  recognition.onend = () => {
    isRecording = false;
    micBtn.style.background = 'transparent';
    micBtn.style.color = '#94a3b8';
    chatInput.placeholder = 'Hazme una pregunta o dictame...';
    
    // Si capturó texto, enviarlo automáticamente
    if (chatInput.value.trim()) {
      handleSendMessage();
    }
  };

  micBtn.addEventListener('click', () => {
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
} else {
  micBtn.style.display = 'none'; // Ocultar si no está soportado en el motor de Safari
}

// Clic en enviar o presionar Enter
sendBtn.addEventListener('click', handleSendMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') handleSendMessage();
});

// Función Principal de Envío
async function handleSendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = '';
  appendMessage(text, 'user');

  chatHistory.push({ role: 'user', parts: [{ text }] });

  // Indicador de escritura
  const typingIndicator = showTypingIndicator();

  try {
    const chosenModel = modelSelector.value;
    let replyText = '';

    if (chosenModel.startsWith('groq/')) {
      // LLAMADA A GROQ (Gratis Llama)
      replyText = await callGroq(text);
    } else if (chosenModel.startsWith('gpt-')) {
      // LLAMADA A CHATGPT (OpenAI)
      replyText = await callOpenAi(text);
    } else {
      // LLAMADA A GEMINI 3.5 FLASH (Google)
      replyText = await callGemini(text);
    }

    removeTypingIndicator(typingIndicator);
    appendMessage(replyText, 'agent');
    chatHistory.push({ role: 'model', parts: [{ text: replyText }] });

    // Leer respuesta en voz alta por TTS nativo de iOS
    speakText(replyText);

  } catch (err) {
    removeTypingIndicator(typingIndicator);
    appendMessage(`Error: ${err.message}`, 'system');
  }
}

// Conexión con Groq
async function callGroq(prompt) {
  const url = "https://api.groq.com/openai/v1/chat/completions";
  const modelSlug = modelSelector.value.replace('groq/', '');

  const messages = chatHistory.map(item => ({
    role: item.role === 'model' ? 'assistant' : 'user',
    content: item.parts[0].text
  }));

  messages.unshift({
    role: "system",
    content: "Eres KenchAI, un asistente de IA potente, preciso y el compañero inteligente personal de Kenchin. Responde siempre en español de forma conversacional, clara y directa. Estás operando en su iPhone."
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_KEY}`
    },
    body: JSON.stringify({
      model: modelSlug,
      messages: messages
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Fallo de conexión con Groq');
  }

  const resJson = await response.json();
  return resJson.choices[0].message.content;
}

// Conexión con OpenAI
async function callOpenAi(prompt) {
  const url = "https://api.openai.com/v1/chat/completions";
  
  // Transformar historial al estándar de OpenAI
  const messages = chatHistory.map(item => ({
    role: item.role === 'model' ? 'assistant' : 'user',
    content: item.parts[0].text
  }));

  messages.unshift({
    role: "system",
    content: "Eres KenchAI, un asistente de IA potente, preciso y el compañero inteligente personal de Kenchin. Responde siempre en español de forma conversacional, clara y directa. Estás operando en su iPhone."
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`
    },
    body: JSON.stringify({
      model: modelSelector.value,
      messages: messages
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Fallo de conexión con OpenAI');
  }

  const resJson = await response.json();
  return resJson.choices[0].message.content;
}

// Conexión con Gemini
async function callGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;
  
  const contents = chatHistory.map(item => ({
    role: item.role === 'agent' ? 'model' : item.role,
    parts: item.parts
  }));

  const requestBody = {
    contents: contents,
    systemInstruction: {
      parts: [{
        text: "Eres KenchAI, un asistente de IA potente, preciso y el compañero inteligente personal de Kenchin. Responde siempre en español de forma conversacional, clara y directa en su iPhone."
      }]
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Fallo de conexión con Gemini');
  }

  const resJson = await response.json();
  return resJson.candidates[0].content.parts[0].text;
}

// Auxiliares del Chat
function appendMessage(text, sender) {
  const msg = document.createElement('div');
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'typing-indicator';
  indicator.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  `;
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return indicator;
}

function removeTypingIndicator(element) {
  if (element && element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

// Hablar respuesta por TTS nativo
function speakText(text) {
  window.speechSynthesis.cancel(); // Detener cualquier reproducción previa
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'es-ES';
  window.speechSynthesis.speak(utterance);
}
