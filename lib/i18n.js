import { useState, useEffect, createContext, useContext } from 'react';

// Dictionaries for English, Tamil (தமிழ்), and Hindi (हिन्दी)
export const translations = {
  en: {
    // Navigation & General
    app_name: 'EasyTrack',
    tagline: 'Track. Manage. Grow.',
    today: 'Today',
    dispatch: 'Dispatch',
    finance: 'Financial Insights',
    shops: 'Shops',
    routes: 'Routes',
    settings: 'Settings',
    sign_out: 'Sign Out',
    welcome: 'Welcome',
    loading: 'Loading...',

    // Metrics & Headers
    total_sales: 'Total Sales',
    cash_collected: 'Cash Collected',
    outstanding: 'Outstanding Credit',
    active_agents: 'Active Agents',
    defaulters: 'Overdue Defaulters',
    pending_bills: 'Pending Bills',
    
    // Actions & Buttons
    book_order: 'Book Order',
    deliver: 'Deliver',
    returns: 'Returns',
    expenses: 'Expenses',
    leave: 'Leave',
    submit: 'Submit Order',
    confirm_payment: 'Confirm Payment',
    check_in: 'GPS Check-In',
    scan_qr: 'Scan Shop QR',
    navigate: 'Navigate Map',

    // Statuses
    draft: 'Draft',
    approved: 'Approved',
    delivered: 'Delivered',
    paid: 'Paid',
    credit_hold: 'Credit Hold',
    trial: '7-Day Trial',
  },

  ta: {
    // Navigation & General (Tamil - தமிழ்)
    app_name: 'ஈசிட்ராக்',
    tagline: 'கண்காணிப்பு. மேலாண்மை. வளர்ச்சி.',
    today: 'இன்று',
    dispatch: 'டெலிவரி',
    finance: 'நிதி அறிக்கைகள்',
    shops: 'கடைகள்',
    routes: 'வழித்தடங்கள்',
    settings: 'அமைப்புகள்',
    sign_out: 'வெளியேறு',
    welcome: 'நல்வரவு',
    loading: 'ஏற்றப்படுகிறது...',

    // Metrics & Headers
    total_sales: 'மொத்த விற்பனை',
    cash_collected: 'வசூலித்த பணம்',
    outstanding: 'நிலுவைத் தொகை',
    active_agents: 'செயலில் உள்ள முகவர்கள்',
    defaulters: 'நிலுவை வைத்துள்ள கடைகள்',
    pending_bills: 'நிலுவை பில்கள்',

    // Actions & Buttons
    book_order: 'ஆர்டர் பதிவு செய்ய',
    deliver: 'டெலிவரி செய்ய',
    returns: 'திரும்பப் பெற்றவை',
    expenses: 'செலவுகள்',
    leave: 'விடுமுறை',
    submit: 'ஆர்டர் அனுப்பு',
    confirm_payment: 'பணம் உறுதிசெய்',
    check_in: 'ஜிபிஎஸ் செக்-இன்',
    scan_qr: 'QR ஸ்கேன் செய்ய',
    navigate: 'வழித்தடம் பார்க்க',

    // Statuses
    draft: 'வரைவு',
    approved: 'அனுமதிக்கப்பட்டது',
    delivered: 'டெலிவரி செய்யப்பட்டது',
    paid: 'பணம் செலுத்தப்பட்டது',
    credit_hold: 'கடன் நிறுத்தம்',
    trial: '7 நாட்கள் சோதனை',
  },

  hi: {
    // Navigation & General (Hindi - हिन्दी)
    app_name: 'इजीट्रैक',
    tagline: 'ट्रैक. प्रबंधन. प्रगति.',
    today: 'आज',
    dispatch: 'डिसपैच',
    finance: 'वित्तीय विवरण',
    shops: 'दुकानें',
    routes: 'मार्ग',
    settings: 'सेटिंग्स',
    sign_out: 'साइन आउट',
    welcome: 'स्वागत है',
    loading: 'लोड हो रहा है...',

    // Metrics & Headers
    total_sales: 'कुल बिक्री',
    cash_collected: 'वसूली की गई राशि',
    outstanding: 'बकाया राशि',
    active_agents: 'सक्रिय एजेंट',
    defaulters: 'बकाया वाले दुकानदार',
    pending_bills: 'बकाया बिल',

    // Actions & Buttons
    book_order: 'ऑर्डर बुक करें',
    deliver: 'डिलीवरी करें',
    returns: 'वापसी सामान',
    expenses: 'खर्च',
    leave: 'छुट्टी',
    submit: 'ऑर्डर भेजें',
    confirm_payment: 'भुगतान की पुष्टि करें',
    check_in: 'जीपीएस चेक-इन',
    scan_qr: 'क्यूआर स्कैन करें',
    navigate: 'मैप देखें',

    // Statuses
    draft: 'ड्राफ्ट',
    approved: 'स्वीकृत',
    delivered: 'डिलीवर किया गया',
    paid: 'भुगतान किया गया',
    credit_hold: 'क्रेडिट होल्ड',
    trial: '7 दिनों का ट्रायल',
  }
};

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('en');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('et_language') || 'en';
      setLang(savedLang);
    }
  }, []);

  const changeLanguage = (newLang) => {
    setLang(newLang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('et_language', newLang);
    }
  };

  const t = (key) => {
    const dict = translations[lang] || translations.en;
    return dict[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if not wrapped in provider
    return {
      lang: 'en',
      changeLanguage: () => {},
      t: (key) => translations.en[key] || key
    };
  }
  return context;
}
