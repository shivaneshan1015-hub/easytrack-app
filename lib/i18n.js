import { useState, useEffect, createContext, useContext } from 'react';

// Comprehensive Translation Dictionaries for English, Tamil (தமிழ்), and Hindi (हिन्दी)
export const translations = {
  en: {
    // Navigation & Tabs
    app_name: 'EasyTrack',
    tagline: 'Track. Manage. Grow.',
    today: 'Today',
    today_orders: "Today's Orders",
    dispatch: 'Dispatch History',
    finance: 'Financial Insights',
    shops: 'Shop Directory',
    routes: 'Route Optimizer',
    settings: 'Settings & Team',
    van_loads: 'Van Stock Load',
    sign_out: 'Sign Out',
    welcome: 'Welcome',
    loading: 'Loading...',

    // Agent Tabs
    book_order_tab: '📝 Book Order',
    deliver_tab: '📦 Deliver & Collect',
    returns_tab: '↩ Returns',
    expenses_tab: '💰 Expenses',
    leave_tab: '🏖️ Leave',

    // Dashboard Metrics & Headers
    total_sales: 'TOTAL REVENUE',
    cash_collected: 'COLLECTED CASH',
    outstanding: 'OUTSTANDING CREDIT',
    active_agents: 'Active Agents Online',
    defaulters: 'Overdue Defaulters',
    pending_bills: 'Pending Bills',
    aging_breakdown: 'Credit Aging Breakdown',
    agent_rankings: 'Agent Sales Leaderboard',
    
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
    approve: 'Approve',
    print_invoice: 'Print Invoice',
    add_product: '+ Add Product',
    add_shop: '+ Add Shop',
    close_day: '🌙 Close Day',
    select_shop: 'Select Retail Shop',
    select_product: 'Select Product',
    order_total: 'Order Total',
    submitting: 'Submitting...',

    // Statuses & Badges
    draft: 'Draft',
    approved: 'Approved',
    delivered: 'Delivered',
    paid: 'Paid',
    credit_hold: 'Credit Hold',
    trial: '7-Day Trial',
    credit_available: 'Credit Headroom',
    overdue: 'Overdue Warning',
  },

  ta: {
    // Navigation & Tabs (Tamil - தமிழ்)
    app_name: 'ஈசிட்ராக்',
    tagline: 'கண்காணிப்பு. மேலாண்மை. வளர்ச்சி.',
    today: 'இன்று',
    today_orders: 'இன்றைய ஆர்டர்கள்',
    dispatch: 'டெலிவரி வரலாறு',
    finance: 'நிதி அறிக்கைகள்',
    shops: 'கடைகள் விவரம்',
    routes: 'வழித்தட திட்டம்',
    settings: 'அமைப்புகள் & குழு',
    van_loads: 'வண்டி சரக்கு மேலாண்மை',
    sign_out: 'வெளியேறு',
    welcome: 'நல்வரவு',
    loading: 'ஏற்றப்படுகிறது...',

    // Agent Tabs
    book_order_tab: '📝 ஆர்டர் பதிவு',
    deliver_tab: '📦 டெலிவரி & வசூல்',
    returns_tab: '↩ திரும்ப பெற்றவை',
    expenses_tab: '💰 செலவுகள்',
    leave_tab: '🏖️ விடுமுறை',

    // Dashboard Metrics & Headers
    total_sales: 'மொத்த விற்பனை',
    cash_collected: 'வசூலித்த பணம்',
    outstanding: 'நிலுவைத் தொகை',
    active_agents: 'செயலில் உள்ள முகவர்கள்',
    defaulters: 'நிலுவை வைத்துள்ள கடைகள்',
    pending_bills: 'நிலுவை பில்கள்',
    aging_breakdown: 'கடன் காலக்கெடு வகைப்பாடு',
    agent_rankings: 'முகவர் விற்பனை பட்டியல்',

    // Actions & Buttons
    book_order: 'ஆர்டர் பதிவு செய்ய',
    deliver: 'டெலிவரி செய்ய',
    returns: 'திரும்பப் பெற்றவை',
    expenses: 'செலவுகள்',
    leave: 'விடுமுறை',
    submit: 'ஆர்டர் சமர்ப்பி',
    confirm_payment: 'பணம் உறுதிசெய்',
    check_in: 'ஜிபிஎஸ் செக்-இன்',
    scan_qr: 'QR ஸ்கேன் செய்ய',
    navigate: 'வழித்தடம் பார்க்க',
    approve: 'அனுமதி',
    print_invoice: 'பில் அச்சிடு',
    add_product: '+ தயாரிப்பு சேர்',
    add_shop: '+ கடை சேர்',
    close_day: '🌙 நாள் முடிவு',
    select_shop: 'கடையை தேர்ந்தெடுக்கவும்',
    select_product: 'தயாரிப்பை தேர்ந்தெடுக்கவும்',
    order_total: 'மொத்த தொகை',
    submitting: 'அனுப்பப்படுகிறது...',

    // Statuses & Badges
    draft: 'வரைவு',
    approved: 'அனுமதிக்கப்பட்டது',
    delivered: 'டெலிவரி செய்யப்பட்டது',
    paid: 'பணம் செலுத்தப்பட்டது',
    credit_hold: 'கடன் நிறுத்தம்',
    trial: '7 நாட்கள் சோதனை',
    credit_available: 'கடன் வரம்பு',
    overdue: 'காலக்கெடு முடிந்தது',
  },

  hi: {
    // Navigation & Tabs (Hindi - हिन्दी)
    app_name: 'इजीट्रैक',
    tagline: 'ट्रैक. प्रबंधन. प्रगति.',
    today: 'आज',
    today_orders: 'आज के ऑर्डर',
    dispatch: 'डिसपैच इतिहास',
    finance: 'वित्तीय विवरण',
    shops: 'दुकान सूची',
    routes: 'रूट ऑप्टिमाइज़र',
    settings: 'सेटिंग्स और टीम',
    van_loads: 'वैन स्टॉक लोड',
    sign_out: 'साइन आउट',
    welcome: 'स्वागत है',
    loading: 'लोड हो रहा है...',

    // Agent Tabs
    book_order_tab: '📝 ऑर्डर बुक करें',
    deliver_tab: '📦 डिलीवरी और वसूली',
    returns_tab: '↩ वापसी सामान',
    expenses_tab: '💰 खर्च',
    leave_tab: '🏖️ छुट्टी',

    // Dashboard Metrics & Headers
    total_sales: 'कुल बिक्री',
    cash_collected: 'वसूली की गई राशि',
    outstanding: 'बकाया राशि',
    active_agents: 'सक्रिय एजेंट',
    defaulters: 'बकाया वाले दुकानदार',
    pending_bills: 'बकाया बिल',
    aging_breakdown: 'क्रेडिट आयु विवरण',
    agent_rankings: 'एजेंट प्रदर्शन रैंकिंग',

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
    approve: 'मंजूर करें',
    print_invoice: 'रसीद प्रिंट करें',
    add_product: '+ उत्पाद जोड़ें',
    add_shop: '+ दुकान जोड़ें',
    close_day: '🌙 दिन समाप्त करें',
    select_shop: 'दुकान चुनें',
    select_product: 'उत्पाद चुनें',
    order_total: 'कुल राशि',
    submitting: 'भेजा जा रहा है...',

    // Statuses & Badges
    draft: 'ड्राफ्ट',
    approved: 'स्वीकृत',
    delivered: 'डिलीवर किया गया',
    paid: 'भुगतान किया गया',
    credit_hold: 'क्रेडिट होल्ड',
    trial: '7 दिनों का ट्रायल',
    credit_available: 'क्रेडिट सीमा',
    overdue: 'समयावधि समाप्त',
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
    return {
      lang: 'en',
      changeLanguage: () => {},
      t: (key) => translations.en[key] || key
    };
  }
  return context;
}
