import { Navigate, Route, Routes } from "react-router-dom";
import { Chat } from "./pages/Chat";
import { Landing } from "./pages/Landing";
import { Plans } from "./pages/Plans";
import { Login } from "./pages/Login";
import { RequireAuth } from "./auth/RequireAuth";

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/plans" element={<Plans />} />
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
