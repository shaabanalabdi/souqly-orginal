import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { AdminPage } from './pages/AdminPage';
import { ChatPage } from './pages/ChatPage';
import { CreateListingPage } from './pages/CreateListingPage';
import { DealsPage } from './pages/DealsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { ListingDetailsPage } from './pages/ListingDetailsPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PreferencesPage } from './pages/PreferencesPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SeoLandingPage } from './pages/SeoLandingPage';
import { TermsPage } from './pages/TermsPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';
import { BusinessProfilePage } from './pages/BusinessProfilePage';
import { CraftsmanProfilePage } from './pages/CraftsmanProfilePage';
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
          <Route path="/listings/:id" element={<ListingDetailsPage />} />
          <Route path="/seo/:countryCode/:cityId/:categorySlug" element={<SeoLandingPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/listings/create" element={<CreateListingPage />} />
            <Route path="/chats" element={<ChatPage />} />
            <Route path="/deals" element={<DealsPage />} />
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
