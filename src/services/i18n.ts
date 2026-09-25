import { LanguageCode } from '../types';

export const translations = {
  en: {
    appTitle: 'NER LENS Driver',
    appSubtitle: 'Smarter Routes · Safer Journeys',
    corridorBadge: 'NORTHEAST CORRIDOR LOGISTICS',
    
    // Auth
    loginTitle: 'Driver & Field Sign In',
    loginSubtitle: 'Enter your credentials to access assigned mountain corridor deliveries',
    emailLabel: 'Email / Driver ID',
    passwordLabel: 'Password',
    signInButton: 'Sign In to Vehicle Console',
    quickPresets: 'Quick Test Accounts:',
    driverRehan: 'Driver Rehan (DRV-042, Dimapur-Kohima)',
    driverAo: 'Driver T. Ao (Field Dual-Role)',
    offlineModeNotice: 'Working in offline / disconnected mode with local cryptographic verification.',
    
    // Mission Statuses
    planned: 'PLANNED',
    accepted: 'ACCEPTED',
    active: 'ONGOING',
    delivered: 'DELIVERED',
    cancelled: 'CANCELLED',
    pendingSync: 'PENDING SYNC',
    
    // Actions
    acceptMission: 'Accept Mission',
    rejectMission: 'Reject Mission',
    startMission: 'Start Journey',
    declareDelivery: 'Declare Delivery',
    reportIncident: 'Report Incident',
    myRoutes: 'My Routes',
    offlineReports: 'Offline Outbox',
    emergencySOS: 'EMERGENCY SOS',
    preTripCheck: 'Pre-Trip Inspection',
    
    // Telemetry & Corridor
    currentMission: 'Current Assigned Mission',
    corridor: 'Corridor',
    vehicle: 'Vehicle',
    cargo: 'Cargo',
    eta: 'Est. Duration',
    distance: 'Distance',
    altitude: 'Current Altitude',
    speed: 'Current Speed',
    speedCap: 'Mountain Speed Cap',
    weighbridgeNext: 'Medziphema Weighbridge',
    checkpointClearance: 'Auto-Clearance Stamped',
    
    // Hazards
    landslideRisk: 'LANDSLIDE HAZARD',
    heavyRain: 'HEAVY MONSOON RAIN',
    roadBlocked: 'ROAD BLOCKED',
    weightRestriction: 'WEIGHT RESTRICTION',
    highRisk: 'High Risk',
    moderateRisk: 'Moderate Risk',
    
    // Route Advisories
    baselineWarning: 'PLANNING BASELINE ONLY',
    baselineDisclaimer: 'Unverified Road Graph / Car Free-Flow Model. Does NOT constitute a verified heavy-vehicle turn-by-turn navigation clearance.',
    candidateAvailable: 'Route Change Available',
    acknowledgeCandidate: 'Adopt Candidate Route',
    declineCandidate: 'Decline & Maintain Current',
    
    // Tabs
    tabHome: 'Home',
    tabTrip: 'Route & HUD',
    tabAlerts: 'Risk Alerts',
    tabReports: 'Field Evidence',
    tabSettings: 'Profile',
    
    // Sync
    syncTitle: 'Store-and-Forward Outbox',
    syncDesc: 'Durable offline queue. Mutations replay in strict dependency order when connectivity resumes.',
    itemsQueued: 'Items awaiting sync',
    retryNow: 'Replay Queue Now',
    allSynced: 'All local records synchronized with server authority.',
    
    // Settings & Permissions
    driverProfile: 'Driver Profile',
    locationConsent: 'GPS Tracking Consent',
    locationActive: 'Active corridor breadcrumbs enabled',
    langSelect: 'Language (ভাষা)',
    signOut: 'Sign Out & Purge Private Cache',
  },
  
  as: {
    appTitle: 'এন ই আৰ লেন্স চালক',
    appSubtitle: 'স্মাৰ্ট পথ · সুৰক্ষিত যাত্ৰা',
    corridorBadge: 'উত্তৰ-পূব কৰিডৰ লজিষ্টিক',
    
    // Auth
    loginTitle: 'চালক আৰু ফিল্ড প্ৰৱেশ',
    loginSubtitle: 'আপোনাৰ নিৰ্দিষ্ট পৰিবহণ চাবলৈ তথ্য প্ৰৱিষ্ট কৰক',
    emailLabel: 'ইমেইল / চালক আইডি',
    passwordLabel: 'পাছৱৰ্ড',
    signInButton: 'বাহন কনচোলত প্ৰৱেশ কৰক',
    quickPresets: 'দ্ৰুত পৰীক্ষামূলক একাউন্ট:',
    driverRehan: 'চালক ৰেহান (DRV-042, ডিমাপুৰ-কোহিমা)',
    driverAo: 'চালক টি. আও (দ্বৈত ভূমিকা)',
    offlineModeNotice: 'ইন্টাৰনেট অবিহনে অফলাইন অৱস্থাত কাম কৰি থকা হৈছে।',
    
    // Mission Statuses
    planned: 'পৰিকল্পিত',
    accepted: 'গৃহীত',
    active: 'চলমান',
    delivered: 'বিতৰণ কৰা হ’ল',
    cancelled: 'বাতিল',
    pendingSync: 'সংযোগৰ অপেক্ষাত',
    
    // Actions
    acceptMission: 'মিছন গ্ৰহণ কৰক',
    rejectMission: 'মিছন নাকচ কৰক',
    startMission: 'যাত্ৰা আৰম্ভ কৰক',
    declareDelivery: 'বিতৰণ ঘোষণা কৰক',
    reportIncident: 'ঘটনা প্ৰতিবেদন দিয়ক',
    myRoutes: 'মোৰ পথসমূহ',
    offlineReports: 'অফলাইন আউটবক্স',
    emergencySOS: 'আপদকালীন SOS',
    preTripCheck: 'যাত্ৰাৰ পূৰ্বৰ পৰীক্ষা',
    
    // Telemetry & Corridor
    currentMission: 'বৰ্তমানৰ নিৰ্দিষ্ট মিছন',
    corridor: 'কৰিডৰ',
    vehicle: 'বাহন',
    cargo: 'সামগ্ৰী',
    eta: 'আনুমানিক সময়',
    distance: 'দূৰত্ব',
    altitude: 'উচ্চতা',
    speed: 'বৰ্তমান গতি',
    speedCap: 'পাহাৰীয়া গতিসীমা',
    weighbridgeNext: 'মেদজিফেমা ওজন কঁটা',
    checkpointClearance: 'অনুমোদিত স্টাম্প',
    
    // Hazards
    landslideRisk: 'ভূমিস্খলনৰ আশংকা',
    heavyRain: 'প্ৰচণ্ড বৰষুণ',
    roadBlocked: 'পথ বন্ধ হৈ আছে',
    weightRestriction: 'ওজনৰ নিষেধাজ্ঞা',
    highRisk: 'অত্যধিক বিপদ',
    moderateRisk: 'মধ্যম বিপদ',
    
    // Route Advisories
    baselineWarning: 'কেৱল পৰিকল্পনা ভিত্তিমূল',
    baselineDisclaimer: 'অপৰীক্ষিত পথ গ্ৰাফ। গধুৰ বাহনৰ বাবে সুনিশ্চিত নিৰাপত্তা অনুমতি নহয়।',
    candidateAvailable: 'নতুন বিকল্প পথ উপলব্ধ',
    acknowledgeCandidate: 'বিকল্প পথ গ্ৰহণ কৰক',
    declineCandidate: 'বৰ্তমান পথতে থাকক',
    
    // Tabs
    tabHome: 'মূল পৃষ্ঠা',
    tabTrip: 'পথ আৰু HUD',
    tabAlerts: 'সতৰ্কবাৰ্তা',
    tabReports: 'ক্ষেত্ৰ প্ৰমাণ',
    tabSettings: 'প্ৰফাইল',
    
    // Sync
    syncTitle: 'অফলাইন সংৰক্ষণ আউটবক্স',
    syncDesc: 'ইন্টাৰনেট পোৱাৰ লগে লগে এই তথ্যসমূহ ক্ৰমানুসৰি ছাৰ্ভাৰলৈ প্ৰেৰণ হ’ব।',
    itemsQueued: 'প্ৰেৰণৰ বাবে বাকী থকা তথ্য',
    retryNow: 'পুনৰ চেষ্টা কৰক',
    allSynced: 'সকলো তথ্য ছাৰ্ভাৰৰ সৈতে মিলি গৈছে।',
    
    // Settings & Permissions
    driverProfile: 'চালকৰ বিৱৰণ',
    locationConsent: 'GPS অৱস্থানৰ অনুমতি',
    locationActive: 'লাইভ ট্ৰেকিং সক্ৰিয় আছে',
    langSelect: 'ভাষা (Language)',
    signOut: 'লগ আউট আৰু কেচ মচক',
  },
};

let currentLang: LanguageCode = 'en';

export function setLanguage(lang: LanguageCode) {
  currentLang = lang;
}

export function getLanguage(): LanguageCode {
  return currentLang;
}

export function t(key: keyof typeof translations['en']): string {
  return translations[currentLang][key] || translations['en'][key] || key;
}
