import React from "react";
import PageNotFound from "./PageNotFound";
import DetailProduct from "./Pages/DetailProduct";
import ProtectedRoute from "./ProtectedRoute";
import { Navigate, Route, Routes } from "react-router-dom";
import CreateProduct from "./Pages/CreateProduct";
import Product from "./Pages/Product";
import Home from "./Pages/Home";
import OwnerDashBoard from "./admin/OwnerDashBoard";
import OwnerRegister from "./admin/OwnerRegister";
import OwnerOrders from "./admin/OwnerOrders";
import OwnerInventory from "./admin/OwnerInventory";
import OwnerCustomers from "./admin/OwnerCustomers";
import OwnerNotifications from "./admin/OwnerNotifications";
import UserOrders from "./User/UserOrders";
import UserProfile from "./User/UserProfile";
import Register from "./User/Register";
import Login from "./User/Login";
import Cart from "./Pages/Cart";
import Checkout from "./Pages/Checkout";
import CreateOrder from "./Pages/CreateOrder";

const MainRoutes = () => {
  return (
    <div className="app-container">
      <Routes>
        {/* Default */}
        <Route path="/" element={<Home />} />

        {/* User Auth */}
        <Route
          path="/login"
          element={
            <div className="auth-route-center">
              <Login />
            </div>
          }
        />
        <Route
          path="/register"
          element={
            <div className="auth-route-center">
              <Register />
            </div>
          }
        />

        {/* Owner/Admin Auth */}
        <Route
          path="/owner/login"
          element={<Navigate to="/login?role=owner" replace />}
        />
        <Route
          path="/owner/register"
          element={
            <div className="auth-route-center">
              <OwnerRegister />
            </div>
          }
        />

        {/* Owner/Admin Dashboard */}
        <Route
          path="/owner/dashboard"
          element={
            <ProtectedRoute>
              <OwnerDashBoard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/owner/products"
          element={
            <ProtectedRoute>
              <Product />
            </ProtectedRoute>
          }
        />

        <Route
          path="/owner/orders"
          element={
            <ProtectedRoute>
              <OwnerOrders />
            </ProtectedRoute>
          }
        />

        <Route
          path="/owner/inventory"
          element={
            <ProtectedRoute>
              <OwnerInventory />
            </ProtectedRoute>
          }
        />

        <Route
          path="/owner/customers"
          element={
            <ProtectedRoute>
              <OwnerCustomers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/owner/notifications"
          element={
            <ProtectedRoute>
              <OwnerNotifications />
            </ProtectedRoute>
          }
        />

        <Route
          path="/products"
          element={
            <ProtectedRoute>
              <Product />
            </ProtectedRoute>
          }
        >
          <Route
            path="/products/create-product"
            element={
              <ProtectedRoute>
                <CreateProduct />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route
          path="/products/:id"
          element={
            <ProtectedRoute>
              <DetailProduct />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cart"
          element={
            <ProtectedRoute>
              <Cart />
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <UserOrders />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />

        <Route
          path="/checkout"
          element={
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-order"
          element={
            <ProtectedRoute>
              <CreateOrder />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </div>
  );
};

export default MainRoutes;
