import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../lib/i18n';

/**
 * AI Assistant Widget for Owners to ask instant questions about business metrics & app usage
 */
export default function OwnerAiAssistantWidget({
  financials = { totalSales: 0, totalCollected: 0, totalOutstanding: 0 },
  activeAgents = [],
  productsCatalog = [],
  registeredShops = []
}) {
  const { lang, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      sender: 'ai',
      text: lang === 'ta'
        ? 'வணக்கம்! நான் ஈசிட்ராக் AI உதவியாளன். உங்கள் வியாபார விற்பனை, நிலுவைத் தொகை, அல்லது செயலி அமைப்புகள் பற்றி ஏதேனும் கேட்க விரும்புகிறீர்களா?'
        : lang === 'hi'
        ? 'नमस्ते! मैं इजीट्रैक AI सहायक हूँ। अपनी बिक्री, बकाया राशि, या ऐप सेटिंग्स के बारे में कुछ भी पूछें!'
        : 'Hello! I am your EasyTrack AI Assistant. Ask me anything about your daily revenue, overdue credit, field agents, or how to use the app!'
    }
  ]);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = (textToSend) => {
    const userQ = textToSend || query;
    if (!userQ.trim()) return;

    const newMsgs = [...messages, { sender: 'user', text: userQ }];
    setMessages(newMsgs);
    if (!textToSend) setQuery('');

    // Generate AI response based on live metrics and business logic
    setTimeout(() => {
      const qLower = userQ.toLowerCase();
      let answer = '';

      if (qLower.includes('sales') || qLower.includes('revenue') || qLower.includes('விற்பனை') || qLower.includes('बिक्री')) {
        answer = `📊 Today's Total Sales Revenue is ₹${parseFloat(financials.totalSales || 0).toLocaleString('en-IN')}. Total Cash Collected so far is ₹${parseFloat(financials.totalCollected || 0).toLocaleString('en-IN')}.`;
      } else if (qLower.includes('credit') || qLower.includes('defaulter') || qLower.includes('pending') || qLower.includes('நிலுவை') || qLower.includes('बकाया')) {
        answer = `💳 Total Outstanding Credit across all shops is ₹${parseFloat(financials.totalOutstanding || 0).toLocaleString('en-IN')}. You can send automated WhatsApp payment reminders to defaulters from the Financial Insights tab!`;
      } else if (qLower.includes('agent') || qLower.includes('rep') || qLower.includes('முகவர்') || qLower.includes('एजेंट')) {
        answer = `🟢 You have ${activeAgents.length} active sales agent(s) registered on your team. To invite a new field rep, go to Settings & Team -> Invite Agent.`;
      } else if (qLower.includes('stock') || qLower.includes('product') || qLower.includes('தயாரிப்பு') || qLower.includes('उत्पाद')) {
        const lowStock = productsCatalog.filter(p => p.inventory_stock <= (p.low_stock_threshold || 10));
        answer = `📦 Total items in Catalog: ${productsCatalog.length}. Low stock alerts: ${lowStock.length} item(s) running low.`;
      } else if (qLower.includes('whatsapp') || qLower.includes('receipt') || qLower.includes('வாட்ஸ்அப்')) {
        answer = `📱 EasyTrack automatically generates dynamic WhatsApp payment receipt links. Delivery agents can tap 'Share WhatsApp Receipt' on their phone as soon as payment is collected!`;
      } else if (qLower.includes('invite') || qLower.includes('add user') || qLower.includes('சேர்')) {
        answer = `👥 To onboard a new sales agent or dispatcher, navigate to Settings & Team in your sidebar and enter their email address.`;
      } else {
        answer = `💡 I'm here to help! Current Business Snapshot:\n• Today Sales: ₹${parseFloat(financials.totalSales || 0).toLocaleString('en-IN')}\n• Cash Collected: ₹${parseFloat(financials.totalCollected || 0).toLocaleString('en-IN')}\n• Outstanding Credit: ₹${parseFloat(financials.totalOutstanding || 0).toLocaleString('en-IN')}\n• Registered Shops: ${registeredShops.length}`;
      }

      setMessages(prev => [...prev, { sender: 'ai', text: answer }]);
    }, 400);
  };

  const quickQuestions = [
    lang === 'ta' ? '📊 இன்றைய விற்பனை எவ்வளவு?' : lang === 'hi' ? '📊 आज की कुल बिक्री कितनी है?' : '📊 What is today revenue?',
    lang === 'ta' ? '💳 நிலுவைத் தொகை எவ்வளவு?' : lang === 'hi' ? '💳 कुल बकाया राशि कितनी है?' : '💳 Who owes us credit?',
    lang === 'ta' ? '👥 முகவர் சேர்ப்பது எப்படி?' : lang === 'hi' ? '👥 एजेंट कैसे जोड़ें?' : '👥 How to invite an agent?',
    lang === 'ta' ? '📦 தயாரிப்பு இருப்பு விவரம்' : lang === 'hi' ? '📦 उत्पाद स्टॉक स्थिति' : '📦 Low stock alerts?',
  ];

  return (
    <div className="no-print" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
      {/* Drawer */}
      {isOpen && (
        <div style={{
          width: '380px',
          maxWidth: 'calc(100vw - 32px)',
          height: '520px',
          maxHeight: 'calc(100vh - 100px)',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginBottom: '12px'
        }}>
          {/* Header */}
          <div style={{ backgroundColor: '#0f172a', color: '#ffffff', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '22px' }}>🤖</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>EasyTrack AI Assistant</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#94a3b8' }}>Real-time Business & App Guidance</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', lineHeight: 1 }}
            >
              ✕
            </button>
          </div>

          {/* Quick Question Pills */}
          <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '6px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
            {quickQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(q)}
                style={{ padding: '4px 10px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: '#334155', cursor: 'pointer', flexShrink: 0 }}
              >
                {q}
              </button>
            ))}
          </div>

          {/* Chat Body */}
          <div style={{ flexGrow: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: '#ffffff' }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  backgroundColor: m.sender === 'user' ? '#16a34a' : '#f1f5f9',
                  color: m.sender === 'user' ? '#ffffff' : '#0f172a',
                  padding: '10px 14px',
                  borderRadius: m.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  whiteSpace: 'pre-line'
                }}
              >
                {m.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            style={{ padding: '12px', backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px' }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === 'ta' ? 'கேள்வி கேட்கவும்...' : lang === 'hi' ? 'प्रश्न पूछें...' : 'Ask AI a question...'}
              style={{ flexGrow: 1, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
            />
            <button
              type="submit"
              style={{ padding: '10px 16px', backgroundColor: '#16a34a', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 20px',
          backgroundColor: '#0f172a',
          color: '#ffffff',
          border: 'none',
          borderRadius: '9999px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: '14px',
          transition: 'transform 0.2s ease'
        }}
      >
        <span style={{ fontSize: '18px' }}>🤖</span>
        <span>{lang === 'ta' ? 'ஈசிட்ராக் AI' : lang === 'hi' ? 'इजीट्रैक AI' : 'Ask EasyTrack AI'}</span>
      </button>
    </div>
  );
}
