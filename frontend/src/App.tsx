import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { ProtectedRoute } from './components/layout/ProtectedRoute';

import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { EventsListPage } from './pages/EventsListPage';
import { EventDetailPage } from './pages/EventDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { BookingConfirmationPage } from './pages/BookingConfirmationPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { CreateEventPage } from './pages/CreateEventPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1a2029',
              color: '#f2f4f7',
              border: '1px solid #2a313c',
              fontSize: 13,
            },
          }}
        />
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/events" element={<EventsListPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />

          <Route
            path="/checkout/:bookingId"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings/:bookingId/confirmation"
            element={
              <ProtectedRoute>
                <BookingConfirmationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <MyBookingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/organizer/new-event"
            element={
              <ProtectedRoute roles={['ORGANIZER', 'ADMIN']}>
                <CreateEventPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
