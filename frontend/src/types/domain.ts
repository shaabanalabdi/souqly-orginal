export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';
export type AccountType = 'INDIVIDUAL' | 'STORE' | 'CRAFTSMAN';
export type StaffRole = 'NONE' | 'MODERATOR' | 'ADMIN';
export type IdentityVerificationStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';
export type TrustTier = 'NEW' | 'VERIFIED' | 'TRUSTED' | 'TOP_SELLER';
export type ListingStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SOLD' | 'EXPIRED' | 'DELETED';
export type ListingCondition = 'NEW' | 'USED';
export type MessageType = 'TEXT' | 'IMAGE' | 'OFFER' | 'PHONE_REQUEST' | 'SYSTEM';
export type OfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COUNTERED';
export type DealStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';
export type EscrowStatus = 'NONE' | 'HELD' | 'RELEASED' | 'REFUNDED';
export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED';
export type DeliveryMethod = 'PICKUP' | 'COURIER';
export type ReportStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';
export type ReportReason = 'FRAUD' | 'INAPPROPRIATE' | 'DUPLICATE' | 'SPAM' | 'OTHER';
export type AttributeType = 'TEXT' | 'NUMBER' | 'SELECT' | 'MULTISELECT' | 'BOOLEAN' | 'DATE';
export type StoreSubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED';
export type StorePlanAnalyticsLevel = 'basic' | 'advanced';

export interface StorePlanDto {
  code: string;
  name: string;
  priceUsdMonthly: number;
  priceUsdQuarterly: number;
  priceUsdYearly: number;
  maxListingsPerMonth: number | null;
  featuredSlots: number;
  analyticsLevel: StorePlanAnalyticsLevel;
}

export interface StoreSubscriptionDto {
  planCode: string;
  planName: string;
  status: StoreSubscriptionStatus;
  startedAt: string;
  expiresAt: string;
  autoRenew: boolean;
  priceUsd: number;
  daysRemaining: number;
}

export interface CurrentStoreSubscriptionDto {
  eligibleForStorePlans: boolean;
  active: boolean;
  subscription: StoreSubscriptionDto | null;
}

export interface BusinessProfileDto {
  companyName: string;
  commercialRegister: string | null;
  taxNumber: string | null;
  website: string | null;
  verifiedByAdmin: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertBusinessProfilePayload {
  companyName: string;
  commercialRegister?: string;
  taxNumber?: string;
  website?: string;
}

export interface UpsertBusinessProfileResult {
  created: boolean;
  verificationReset: boolean;
  profile: BusinessProfileDto;
}

export interface CraftsmanProfileDto {
  profession: string;
  experienceYears: number | null;
  workingHours: string | null;
  workingAreas: string[];
  portfolio: string[];
  availableNow: boolean;
  verifiedByAdmin: boolean;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertCraftsmanProfilePayload {
  profession: string;
  experienceYears?: number;
  workingHours?: string;
  workingAreas?: string[];
  portfolio?: string[];
  availableNow?: boolean;
}

export interface UpsertCraftsmanProfileResult {
  created: boolean;
  verificationReset: boolean;
  profile: CraftsmanProfileDto;
}

export interface SessionUser {
  id: number;
  email: string | null;
  phone: string | null;
  role: UserRole;
  accountType: AccountType;
  staffRole: StaffRole;
  trustTier: TrustTier;
  isActive: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  identityVerificationStatus: IdentityVerificationStatus;
  identityVerifiedAt: string | null;
  fullName: string | null;
  countryId: number | null;
  cityId: number | null;
}

export interface IdentityVerificationRequestSummary {
  id: number;
  userId: number;
  status: IdentityVerificationStatus;
  documentType: string;
  documentNumberMasked: string | null;
  documentFrontUrl: string | null;
  documentBackUrl: string | null;
  selfieUrl: string | null;
  note: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewerId: number | null;
  reviewerNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MyIdentityVerificationResult {
  status: IdentityVerificationStatus;
  verifiedAt: string | null;
  canSubmit: boolean;
  currentRequest: IdentityVerificationRequestSummary | null;
}

export interface Country {
  id: number;
  code: string;
  name: string;
  currencyCode: string;
  currencySymbol: string;
  phoneCode: string;
}

export interface City {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

export interface CountryCities {
  country: Country;
  cities: City[];
}

export interface NearestCityResult {
  city: City;
  country: {
    id: number;
    code: string;
    name: string;
    currencyCode: string;
    currencySymbol: string;
  };
  distanceKm: number;
}

export interface Category {
  id: number;
  slug: string;
  icon: string;
  name: string;
  subcategoryCount: number;
}

export interface Subcategory {
  id: number;
  slug: string;
  name: string;
  attributesCount: number;
}

export interface CategorySubcategories {
  category: {
    id: number;
    slug: string;
    name: string;
  };
  subcategories: Subcategory[];
}

export interface AttributeDefinition {
  id: number;
  slug: string;
  name: string;
  type: AttributeType;
  isRequired: boolean;
  isFilterable: boolean;
  options: string[];
}

export interface SubcategoryAttributes {
  subcategory: {
    id: number;
    slug: string;
    name: string;
  };
  attributes: AttributeDefinition[];
}

export interface ListingSummary {
  id: number;
  title: string;
  description: string;
  priceAmount: number | null;
  currency: string | null;
  negotiable: boolean;
  condition: ListingCondition | null;
  status: ListingStatus;
  country: { id: number; code: string; name: string };
  city: { id: number; name: string };
  subcategory: { id: number; slug: string; name: string };
  coverImage: string | null;
  featuredUntil: string | null;
  isFeatured: boolean;
  createdAt: string;
}

export interface ListingDetails extends ListingSummary {
  images: Array<{ url: string; sortOrder: number }>;
  location: { lat: number | null; lng: number | null };
  contact: { phoneVisible: boolean; whatsappVisible: boolean };
  attributes: Array<{ attributeId: number; name: string; value: string }>;
}

export interface CreateListingPayload {
  subcategoryId: number;
  countryId: number;
  cityId: number;
  titleAr: string;
  titleEn?: string;
  descriptionAr: string;
  descriptionEn?: string;
  priceAmount?: number;
  currency?: string;
  negotiable?: boolean;
  condition?: ListingCondition;
  deliveryAvailable?: boolean;
  countryOfOrigin?: string;
  moqText?: string;
  moqMinQty?: number;
  moqUnit?: string;
  locationLat?: number;
  locationLng?: number;
  phoneVisibility?: boolean;
  whatsappVisibility?: boolean;
  images: string[];
  attributes?: Array<{ attributeDefinitionId: number; value: string }>;
}

export type UpdateListingPayload = Partial<CreateListingPayload>;

export interface ListingQuery {
  page?: number;
  limit?: number;
  q?: string;
  categorySlug?: string;
  subcategoryId?: number;
  countryId?: number;
  cityId?: number;
  minPrice?: number;
  maxPrice?: number;
  condition?: ListingCondition;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'featured';
  withImages?: boolean;
  featuredOnly?: boolean;
}

export interface FavoriteSummary {
  favoriteId: number;
  listing: {
    id: number;
    title: string;
    priceAmount: number | null;
    currency: string | null;
    status: ListingStatus;
    coverImage: string | null;
    countryName: string;
    cityName: string;
  };
  createdAt: string;
}

export type NotificationFrequency = 'instant' | 'daily' | 'weekly';

export interface SavedSearch {
  id: number;
  name: string;
  filters: Record<string, unknown>;
  notificationFrequency: NotificationFrequency;
  createdAt: string;
}

export interface ThreadSummary {
  id: number;
  listingId: number;
  otherUserId: number;
  unreadCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  listing: {
    id: number;
    title: string;
    coverImage: string | null;
    priceAmount: number | null;
    currency: string | null;
  };
  lastMessage: {
    senderId: number;
    type: MessageType;
    content: string;
    createdAt: string;
  } | null;
}

export interface ChatMessage {
  id: number;
  threadId: number;
  senderId: number;
  type: MessageType;
  content: string;
  imageUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface Offer {
  id: number;
  threadId: number;
  listingId: number;
  senderId: number;
  amount: number;
  quantity: number;
  message: string | null;
  status: OfferStatus;
  counterAmount: number | null;
  createdAt: string;
  respondedAt: string | null;
}

export interface Deal {
  id: number;
  listingId: number;
  buyerId: number;
  sellerId: number;
  finalPrice: number;
  quantity: number;
  currency: string;
  status: DealStatus;
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  escrow: {
    status: EscrowStatus;
    amount: number | null;
    currency: string | null;
    providerRef: string | null;
    heldAt: string | null;
    releasedAt: string | null;
    refundedAt: string | null;
  };
  meetingPlace: string | null;
  meetingLat: number | null;
  meetingLng: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DealSummary extends Deal {
  listing: {
    title: string;
    coverImage: string | null;
  };
  otherUserId: number;
}

export interface DealDispute {
  id: number;
  dealId: number;
  openedByUserId: number;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolvedByAdmin: number | null;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DealDisputeResolution {
  deal: Deal;
  dispute: DealDispute;
}

export interface DealReview {
  id: number;
  dealId: number;
  reviewerId: number;
  revieweeId: number;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface UserReport {
  id: number;
  reporterId: number;
  listingId: number | null;
  reportableType: string;
  reportableId: number;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  listing: {
    id: number;
    title: string;
    status: ListingStatus;
  } | null;
}

export interface AdminDashboardStats {
  users: {
    total: number;
    active: number;
    banned: number;
  };
  listings: {
    total: number;
    active: number;
    pending: number;
    rejected: number;
  };
  reports: {
    total: number;
    pending: number;
  };
  deals: {
    total: number;
    completed: number;
  };
}

export interface AdminReport {
  id: number;
  reporterId: number;
  listingId: number | null;
  reportableType: string;
  reportableId: number;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  reporter: {
    email: string | null;
    fullName: string | null;
  };
  listing: {
    id: number;
    title: string;
    status: ListingStatus;
  } | null;
}

export interface AdminUser {
  id: number;
  email: string | null;
  role: UserRole;
  accountType: AccountType;
  staffRole: StaffRole;
  isActive: boolean;
  bannedAt: string | null;
  bannedReason: string | null;
  updatedAt: string;
  trustTier: TrustTier;
  trustScore: number;
  fullName: string | null;
  createdAt: string;
}

export interface AdminAuditLog {
  id: number;
  adminId: number;
  adminEmail: string | null;
  adminName: string | null;
  action: string;
  entityType: string;
  entityId: number;
  oldData: unknown;
  newData: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminFraudFlag {
  auditLogId: number;
  listingId: number;
  listingTitle: string | null;
  actorUserId: number | null;
  actorEmail: string | null;
  riskScore: number;
  signals: Array<{
    code: string;
    severity: string;
    message: string;
    meta?: Record<string, unknown>;
  }>;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminIdentityVerification {
  id: number;
  userId: number;
  status: IdentityVerificationStatus;
  documentType: string;
  documentNumberMasked: string | null;
  note: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewerId: number | null;
  reviewerNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    email: string | null;
    fullName: string | null;
    identityVerificationStatus: IdentityVerificationStatus;
    identityVerifiedAt: string | null;
  };
  reviewer: {
    email: string | null;
    fullName: string | null;
  } | null;
}

export type BlacklistEntryType = 'phone' | 'ip' | 'keyword';

export interface AdminBlacklistEntry {
  id: string;
  type: BlacklistEntryType;
  value: string;
  reason: string | null;
  isActive: boolean;
  createdBy: number;
  updatedBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminFeaturedListingResult {
  id: number;
  featuredUntil: string | null;
  isFeatured: boolean;
  updatedAt: string;
}

export type DigestRunMode = 'daily' | 'weekly' | 'both';

export interface AdminSavedSearchDigestStatus {
  enabled: boolean;
  checkIntervalMs: number;
  daily: {
    lastRunAt: string | null;
    nextDueAt: string;
    isLocked: boolean;
    minIntervalMs: number;
  };
  weekly: {
    lastRunAt: string | null;
    nextDueAt: string;
    isLocked: boolean;
    minIntervalMs: number;
  };
}

export interface AdminSavedSearchDigestRunResult {
  triggeredAt: string;
  frequency: DigestRunMode;
  runs: Array<{
    frequency: 'daily' | 'weekly';
    processedSearches: number;
    matchedSearches: number;
    matchedListings: number;
    notifiedUsers: number;
    emailedUsers: number;
    startedAt: string;
    completedAt: string;
  }>;
  skipped: Array<{
    frequency: 'daily' | 'weekly';
    reason: 'LOCKED' | 'ERROR';
    message?: string;
  }>;
}

export interface AdminSavedSearchDigestHistoryEntry {
  id: string;
  source: 'scheduler' | 'manual';
  frequency: 'daily' | 'weekly';
  processedSearches: number;
  matchedSearches: number;
  matchedListings: number;
  notifiedUsers: number;
  emailedUsers: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  recordedAt: string;
}

export type DigestHistorySort =
  | 'completed_desc'
  | 'completed_asc'
  | 'duration_desc'
  | 'duration_asc';
