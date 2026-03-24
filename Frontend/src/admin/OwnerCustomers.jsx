import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./OwnerCustomers.css";

const AUTH_URL = import.meta.env.VITE_AUTH_SERVICE_URL;

const getDisplayName = (user) => {
  if (user?.fullName && typeof user.fullName === "string") {
    const fullName = user.fullName.trim();
    if (fullName) return fullName;
  }

  if (user?.fullName && typeof user.fullName === "object") {
    const fullName = [user.fullName.firstName, user.fullName.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (fullName) return fullName;
  }

  if (typeof user?.username === "string" && user.username.trim()) {
    return user.username.trim();
  }

  return "Customer";
};

const OwnerCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchValue, setSearchValue] = useState("");

  const fetchCustomers = useCallback(async (isRefresh = false) => {
    if (!AUTH_URL) {
      setError("Auth service URL is not configured");
      setLoading(false);
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError("You are not logged in. Please login again.");
      setLoading(false);
      return;
    }

    try {
      if (isRefresh) {
        setRefreshing(true);
      }

      const response = await axios.get(`${AUTH_URL}/internal/user-emails`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const users = Array.isArray(response?.data?.users)
        ? response.data.users
        : [];

      const normalizedUsers = users.map((user, index) => ({
        id: user?._id || user?.id || user?.email || `customer-${index}`,
        name: getDisplayName(user),
        username: user?.username || "-",
        email: user?.email || "-",
      }));

      setCustomers(normalizedUsers);
      setError("");
    } catch (fetchErr) {
      setError(
        fetchErr?.response?.data?.message ||
          fetchErr?.response?.data?.error ||
          fetchErr?.message ||
          "Customer list could not be loaded. Please refresh and try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredCustomers = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return customers;

    return customers.filter((customer) => {
      return [customer.name, customer.username, customer.email]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [customers, searchValue]);

  return (
    <div className="owner-customers-page">
      <header className="owner-customers-head">
        <div>
          <h1> Customers </h1>
        </div>

        <button
          type="button"
          className="owner-customers-refresh-btn"
          onClick={() => fetchCustomers(true)}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </header>

      <section
        className="owner-customers-toolbar"
        aria-label="Search customers"
      >
        <input
          type="search"
          className="owner-customers-search"
          placeholder="Search by name, username, or email"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
        />
        <span className="owner-customers-count">
          Showing {filteredCustomers.length} of {customers.length}
        </span>
      </section>

      {loading ? (
        <p className="owner-customers-feedback">Loading customers...</p>
      ) : error ? (
        <p className="owner-customers-feedback owner-customers-feedback--error">
          {error}
        </p>
      ) : filteredCustomers.length === 0 ? (
        <p className="owner-customers-feedback">No customers found.</p>
      ) : (
        <>
          <div className="owner-customers-table-wrap">
            <table className="owner-customers-table">
              <thead>
                <tr>
                  <th>Sr.No</th>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer, index) => (
                  <tr key={customer.id}>
                    <td>{index + 1}</td>
                    <td>{customer.name}</td>
                    <td>{customer.username}</td>
                    <td>{customer.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="owner-customers-cards">
            {filteredCustomers.map((customer, index) => (
              <article
                className="owner-customers-card"
                key={`card-${customer.id}`}
              >
                <h3>{customer.name}</h3>
                <div className="owner-customers-card-row">
                  <span>Sr.No</span>
                  <strong>{index + 1}</strong>
                </div>
                <div className="owner-customers-card-row">
                  <span>Username</span>
                  <strong>{customer.username}</strong>
                </div>
                <div className="owner-customers-card-row">
                  <span>Email</span>
                  <strong>{customer.email}</strong>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OwnerCustomers;
