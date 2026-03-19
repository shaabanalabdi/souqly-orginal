import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { AdminPage } from './pages/AdminPage';
import { AboutPage } from './pages/AboutPage';
import { ChatPage } from './pages/ChatPage';
import { CategoryPage } from './pages/CategoryPage';
import { ContactPage } from './pages/ContactPage';
import { CreateListingPage } from './pages/CreateListingPage';
import { DealsPage } from './pages/DealsPage';
import { EditListingPage } from './pages/EditListingPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HelpCenterPage } from './pages/HelpCenterPage';
import { HomePage } from './pages/HomePage';
import { ListingDetailsPage } from './pages/ListingDetailsPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { MyListingsPage } from './pages/MyListingsPage';
import { PreferencesPage } from './pages/PreferencesPage';
import { PriceOffersPage } from './pages/PriceOffersPage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ProhibitedContentPage } from './pages/ProhibitedContentPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SavedSearchesPage } from './pages/SavedSearchesPage';
import { SeoLandingPage } from './pages/SeoLandingPage';
import { SecurityPage } from './pages/SecurityPage';
import { TermsPage } from './pages/TermsPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { BusinessProfilePage } from './pages/BusinessProfilePage';
import { CraftsmanProfilePage } from './pages/CraftsmanProfilePage';
import { SearchPage } from './pages/SearchPage';
import { ProfilePage } from './pages/ProfilePage';
import { StorePage } from './pages/StorePage';
import { CraftsmanPage } from './pages/CraftsmanPage';
import { DashboardPage } from './pages/DashboardPage';
import './styles/app.scss';

function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/store" element={<StorePage />} />
          <Route path="/stores/:storeId" element={<StorePage />} />
          <Route path="/craftsman" element={<CraftsmanPage />} />
          <Route path="/craftsmen/:id" element={<CraftsmanPage />} />
          <Route path="/users/:id" element={<PublicProfilePage />} />
          <Route path="/categories/:categorySlug" element={<CategoryPage />} />
          <Route path="/listings/:id" element={<ListingDetailsPage />} />
          <Route path="/seo/:countryCode/:cityId/:categorySlug" element={<SeoLandingPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/prohibited-content" element={<ProhibitedContentPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/listings/create" element={<CreateListingPage />} />
            <Route path="/listings/:id/edit" element={<EditListingPage />} />
            <Route path="/chats" element={<ChatPage />} />
            <Route path="/my-listings" element={<MyListingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/deals" element={<DealsPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/saved-searches" element={<SavedSearchesPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/offers" element={<PriceOffersPage />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/preferences" element={<PreferencesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/subscriptions" element={<SubscriptionsPage />} />
            <Route path="/business-profile" element={<BusinessProfilePage />} />
            <Route path="/craftsman-profile" element={<CraftsmanProfilePage />} />
          </Route>

          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
