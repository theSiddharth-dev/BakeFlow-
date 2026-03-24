import { useState } from "react";
import { NavLink } from "react-router-dom";
import "./OwnerSidebar.css";

const ownerMenuItems = [
  { key: "dashboard", label: "Dashboard", to: "/owner/dashboard" },
  { key: "products", label: "Products", to: "/owner/products" },
  { key: "orders", label: "Order List", to: "/owner/orders" },
  { key: "inventory", label: "Inventory", to: "/owner/inventory" },
  { key: "customers", label: "Customer", to: "/owner/customers" },
  { key: "notifications", label: "Notifications", to: "/owner/notifications" },
];

const OwnerSidebar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const closeSidebar = () => setIsOpen(false);

  return (
    <div className="owner-sidebar-root">
      <button
        type="button"
        className="owner-sidebar-toggle"
        aria-label="Open owner menu"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        ☰
      </button>

      {isOpen && (
        <div className="owner-sidebar-backdrop" onClick={closeSidebar} />
      )}

      <aside className={`owner-sidebar ${isOpen ? "owner-sidebar--open" : ""}`}>
        <div className="owner-sidebar-header">
          <h2>Admin Panel</h2>
        </div>

        <nav className="owner-sidebar-nav" aria-label="Owner navigation">
          {ownerMenuItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                isActive
                  ? "owner-sidebar-link owner-sidebar-link--active"
                  : "owner-sidebar-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </div>
  );
};

export default OwnerSidebar;
