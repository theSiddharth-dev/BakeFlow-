import "./index.css";
import MainRoutes from "./MainRoutes";
import Navbar from "./Pages/Navbar";
import { useLocation } from "react-router-dom";
import UserSidebar from "./User/UserSidebar";
import OwnerSidebar from "./admin/OwnerSidebar";

const parseJwtPayload = (token) => {
  try {
    const payloadPart = token?.split(".")?.[1];
    if (!payloadPart) return null;

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const normalizeRole = (role) => {
  const safeRole = String(role || "")
    .trim()
    .toLowerCase();

  if (safeRole === "admin") return "owner";
  return safeRole;
};

const App = () => {
  const { pathname } = useLocation();

  const hideNavbarPaths = ["/login", "/register", "/owner/register"];

  const shouldHideNavbar = hideNavbarPaths.includes(pathname);
  const isOwnerRoute = pathname.startsWith("/owner");
  const userSidebarRoutes = [
    "/products",
    "/orders",
    "/profile",
    "/cart",
    "/checkout",
    "/create-order",
  ];
  const isUserSidebarRoute = userSidebarRoutes.some((routePrefix) =>
    pathname.startsWith(routePrefix),
  );

  let authUser = null;
  try {
    authUser = JSON.parse(localStorage.getItem("authUser") || "null");
  } catch {
    authUser = null;
  }

  const token = localStorage.getItem("token");
  const jwtPayload = parseJwtPayload(token);
  const role = normalizeRole(authUser?.role || jwtPayload?.role);

  const shouldShowUserSidebar =
    !shouldHideNavbar && role === "user" && isUserSidebarRoute;
  const shouldShowOwnerSidebar =
    !shouldHideNavbar && role === "owner" && isOwnerRoute;

  const shouldShowAnySidebar = shouldShowUserSidebar || shouldShowOwnerSidebar;

  return (
    <div className="app-shell">
      {!shouldHideNavbar && <Navbar />}

      {shouldShowUserSidebar && <UserSidebar />}
      {shouldShowOwnerSidebar && <OwnerSidebar />}

      <div
        className={`app-shell-content ${
          shouldShowAnySidebar ? "app-shell-content--with-sidebar" : ""
        }`}
      >
        <MainRoutes />
      </div>
    </div>
  );
};

export default App;
