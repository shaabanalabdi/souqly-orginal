import type { SellerCardProps } from '../components/SellerCard';

export interface MarketplaceListing {
  id: number;
  titleAr: string;
  titleEn: string;
  price: number;
  currency: string;
  locationAr: string;
  locationEn: string;
  badgeAr?: string;
  badgeEn?: string;
  imageUrl: string;
}

export interface MarketplaceCategory {
  id: string;
  icon: string;
  nameAr: string;
  nameEn: string;
}

export const marketplaceCategories: MarketplaceCategory[] = [
  { id: 'cars', icon: '🚗', nameAr: 'سيارات', nameEn: 'Cars' },
  { id: 'real-estate', icon: '🏠', nameAr: 'عقارات', nameEn: 'Real Estate' },
  { id: 'electronics', icon: '📱', nameAr: 'إلكترونيات', nameEn: 'Electronics' },
  { id: 'jobs', icon: '💼', nameAr: 'وظائف', nameEn: 'Jobs' },
  { id: 'services', icon: '🛠️', nameAr: 'خدمات', nameEn: 'Services' },
  { id: 'furniture', icon: '🛋️', nameAr: 'أثاث', nameEn: 'Furniture' },
  { id: 'fashion', icon: '👗', nameAr: 'أزياء', nameEn: 'Fashion' },
  { id: 'pets', icon: '🐾', nameAr: 'حيوانات أليفة', nameEn: 'Pets' },
];

export const marketplaceListings: MarketplaceListing[] = [
  {
    id: 101,
    titleAr: 'هيونداي إلنترا 2020 بحالة ممتازة',
    titleEn: 'Hyundai Elantra 2020 in Excellent Condition',
    price: 148000000,
    currency: 'SYP',
    locationAr: 'دمشق',
    locationEn: 'Damascus',
    badgeAr: 'مميز',
    badgeEn: 'Featured',
    imageUrl: 'https://picsum.photos/seed/souqly-car/800/600',
  },
  {
    id: 102,
    titleAr: 'شقة للإيجار قرب الجامعة',
    titleEn: 'Apartment for Rent Near University',
    price: 450,
    currency: 'JOD',
    locationAr: 'عمّان',
    locationEn: 'Amman',
    badgeAr: 'جديد',
    badgeEn: 'New',
    imageUrl: 'https://picsum.photos/seed/souqly-home/800/600',
  },
  {
    id: 103,
    titleAr: 'iPhone 14 Pro سعة 256GB',
    titleEn: 'iPhone 14 Pro 256GB',
    price: 1250,
    currency: 'USD',
    locationAr: 'بيروت',
    locationEn: 'Beirut',
    imageUrl: 'https://picsum.photos/seed/souqly-phone/800/600',
  },
  {
    id: 104,
    titleAr: 'خدمة صيانة مكيفات للمنازل والمكاتب',
    titleEn: 'AC Maintenance Service for Homes and Offices',
    price: 35,
    currency: 'USD',
    locationAr: 'بغداد',
    locationEn: 'Baghdad',
    badgeAr: 'موثّق',
    badgeEn: 'Verified',
    imageUrl: 'https://picsum.photos/seed/souqly-service/800/600',
  },
  {
    id: 105,
    titleAr: 'كنبة زاوية مودرن بحالة جديدة',
    titleEn: 'Modern Corner Sofa, Like New',
    price: 600,
    currency: 'USD',
    locationAr: 'غزة',
    locationEn: 'Gaza',
    imageUrl: 'https://picsum.photos/seed/souqly-sofa/800/600',
  },
  {
    id: 106,
    titleAr: 'محل تجاري للبيع في موقع حيوي',
    titleEn: 'Commercial Shop for Sale in Prime Location',
    price: 38000,
    currency: 'USD',
    locationAr: 'إربد',
    locationEn: 'Irbid',
    badgeAr: 'عرض خاص',
    badgeEn: 'Special Offer',
    imageUrl: 'https://picsum.photos/seed/souqly-shop/800/600',
  },
  {
    id: 107,
    titleAr: 'حرفي نجارة وتركيب مطابخ',
    titleEn: 'Carpentry & Kitchen Installation Specialist',
    price: 20,
    currency: 'USD',
    locationAr: 'حلب',
    locationEn: 'Aleppo',
    imageUrl: 'https://picsum.photos/seed/souqly-craftsman/800/600',
  },
  {
    id: 108,
    titleAr: 'كاميرا Canon احترافية',
    titleEn: 'Professional Canon Camera',
    price: 980,
    currency: 'USD',
    locationAr: 'رام الله',
    locationEn: 'Ramallah',
    imageUrl: 'https://picsum.photos/seed/souqly-camera/800/600',
  },
];

export const marketplaceCountries = [
  { code: 'SY', labelAr: 'سوريا', labelEn: 'Syria' },
  { code: 'JO', labelAr: 'الأردن', labelEn: 'Jordan' },
  { code: 'LB', labelAr: 'لبنان', labelEn: 'Lebanon' },
  { code: 'PS', labelAr: 'فلسطين', labelEn: 'Palestine' },
  { code: 'IQ', labelAr: 'العراق', labelEn: 'Iraq' },
];

export const listingGallery = [
  'https://picsum.photos/seed/souqly-detail-1/1200/800',
  'https://picsum.photos/seed/souqly-detail-2/1200/800',
  'https://picsum.photos/seed/souqly-detail-3/1200/800',
  'https://picsum.photos/seed/souqly-detail-4/1200/800',
];

export const listingAttributes = [
  { keyAr: 'الحالة', keyEn: 'Condition', valueAr: 'ممتاز', valueEn: 'Excellent' },
  { keyAr: 'الموديل', keyEn: 'Model', valueAr: '2020', valueEn: '2020' },
  { keyAr: 'العداد', keyEn: 'Mileage', valueAr: '45,000 كم', valueEn: '45,000 km' },
  { keyAr: 'الناقل', keyEn: 'Transmission', valueAr: 'أوتوماتيك', valueEn: 'Automatic' },
];

export const sellerMock: SellerCardProps = {
  name: 'أحمد السالم',
  trustScore: 87,
  rating: 4.7,
  reviewCount: 124,
  responseTime: 'خلال 10 دقائق',
  emailVerified: true,
  phoneVerified: true,
  idVerified: true,
};

export interface ChatConversation {
  id: string;
  nameAr: string;
  nameEn: string;
  avatarUrl: string;
  lastMessageAr: string;
  lastMessageEn: string;
  unread: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  textAr: string;
  textEn: string;
  sentAt: string;
  fromMe: boolean;
}

export const chatConversations: ChatConversation[] = [
  {
    id: 'c1',
    nameAr: 'سارة فهد',
    nameEn: 'Sara Fahad',
    avatarUrl: 'https://picsum.photos/seed/souqly-user-1/120/120',
    lastMessageAr: 'هل السعر قابل للتفاوض؟',
    lastMessageEn: 'Is the price negotiable?',
    unread: 2,
  },
  {
    id: 'c2',
    nameAr: 'محمد علي',
    nameEn: 'Mohamed Ali',
    avatarUrl: 'https://picsum.photos/seed/souqly-user-2/120/120',
    lastMessageAr: 'تم إرسال العرض',
    lastMessageEn: 'Offer has been sent',
    unread: 0,
  },
  {
    id: 'c3',
    nameAr: 'ورشة النخبة',
    nameEn: 'Elite Workshop',
    avatarUrl: 'https://picsum.photos/seed/souqly-user-3/120/120',
    lastMessageAr: 'موعد المعاينة غدًا',
    lastMessageEn: 'Inspection is tomorrow',
    unread: 5,
  },
];

export const chatMessages: ChatMessage[] = [
  {
    id: 'm1',
    conversationId: 'c1',
    textAr: 'مرحبًا، هل الإعلان ما زال متاحًا؟',
    textEn: 'Hi, is the listing still available?',
    sentAt: '10:20',
    fromMe: false,
  },
  {
    id: 'm2',
    conversationId: 'c1',
    textAr: 'نعم متاح، تفضل.',
    textEn: 'Yes, it is available.',
    sentAt: '10:22',
    fromMe: true,
  },
  {
    id: 'm3',
    conversationId: 'c1',
    textAr: 'هل السعر قابل للتفاوض؟',
    textEn: 'Is the price negotiable?',
    sentAt: '10:24',
    fromMe: false,
  },
];
