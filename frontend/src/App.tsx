import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./layouts/AppLayout";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Results from "./pages/Results";
import SearchProducts from "./pages/SearchProducts";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Home />} />
          <Route path="search" element={<SearchProducts />} />
          <Route path="results" element={<Results />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
