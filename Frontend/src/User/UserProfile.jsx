import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import "./UserProfile.css";
import { useNavigate } from "react-router-dom";

const AUTH_URL = import.meta.env.VITE_AUTH_SERVICE_URL;

const parseAuthUser = () => {
  try {
    return JSON.parse(localStorage.getItem("authUser") || "null");
  } catch {
    return null;
  }
};

const UserProfile = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const storedUser = useMemo(() => parseAuthUser(), []);

  const [profile, setProfile] = useState({
    fullName: "",
    username: "",
    email: "",
  });
  const [addresses, setAddresses] = useState([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addressesError, setAddressesError] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState({
    type: "",
    message: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [deletingAccount, setDeletingAccount] = useState(false);

  const formatAddress = (address) => {
    if (!address) return "";

    return [
      address.street,
      address.city,
      address.state,
      address.pincode,
      address.country,
    ]
      .filter(Boolean)
      .join(", ");
  };

  const hydrateFromStoredUser = useCallback(() => {
    if (!storedUser) return;

    const fullName = [storedUser.firstName, storedUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    setProfile((prev) => ({
      ...prev,
      fullName: fullName || prev.fullName,
      username: storedUser.username || prev.username,
      email: storedUser.email || prev.email,
    }));
  }, [storedUser]);

  const fetchCurrentUser = useCallback(async () => {
    if (!AUTH_URL) {
      setProfileError("Auth service URL is not configured");
      setLoadingProfile(false);
      return;
    }

    if (!token) {
      setProfileError("You are not logged in. Please login again.");
      setLoadingProfile(false);
      return;
    }

    try {
      setLoadingProfile(true);
      setLoadingAddresses(true);
      setProfileError("");
      setAddressesError("");

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [userResult, addressesResult] = await Promise.allSettled([
        axios.get(`${AUTH_URL}/me`, { headers }),
        axios.get(`${AUTH_URL}/users/me/address`, { headers }),
      ]);

      if (userResult.status !== "fulfilled") {
        throw userResult.reason;
      }

      const response = userResult.value;

      const user = response?.data?.user || {};
      const fullName = [user?.fullName?.firstName, user?.fullName?.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      const nextProfile = {
        fullName: fullName || "-",
        username: user?.username || "-",
        email: user?.email || "-",
      };

      setProfile(nextProfile);

      localStorage.setItem(
        "authUser",
        JSON.stringify({
          email: nextProfile.email,
          username: nextProfile.username,
          firstName: user?.fullName?.firstName || "",
          lastName: user?.fullName?.lastName || "",
          role: user?.role || storedUser?.role || "user",
        }),
      );

      if (addressesResult.status === "fulfilled") {
        setAddresses(addressesResult.value?.data?.addresses || []);
      } else {
        setAddresses([]);
        setAddressesError(
          addressesResult.reason?.response?.data?.message ||
            addressesResult.reason?.response?.data?.error ||
            addressesResult.reason?.message ||
            "Addresses could not be loaded right now.",
        );
      }
    } catch (err) {
      setProfileError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Profile details could not be loaded. Please try again.",
      );
      hydrateFromStoredUser();
      setAddresses([]);
    } finally {
      setLoadingProfile(false);
      setLoadingAddresses(false);
    }
  }, [hydrateFromStoredUser, token, storedUser?.role]);

  useEffect(() => {
    hydrateFromStoredUser();
    fetchCurrentUser();
  }, [fetchCurrentUser, hydrateFromStoredUser]);

  const validateChangePassword = () => {
    const errors = {};

    if (!passwordForm.currentPassword.trim()) {
      errors.currentPassword = "Current password is required";
    }

    if (!passwordForm.newPassword.trim()) {
      errors.newPassword = "New password is required";
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = "New password must be at least 6 characters";
    }

    if (!passwordForm.confirmPassword.trim()) {
      errors.confirmPassword = "Please confirm your new password";
    } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = "New password and confirm password must match";
    }

    if (
      passwordForm.currentPassword &&
      passwordForm.newPassword &&
      passwordForm.currentPassword === passwordForm.newPassword
    ) {
      errors.newPassword = "New password must be different from current";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const onPasswordInput = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }

    if (passwordStatus.message) {
      setPasswordStatus({ type: "", message: "" });
    }
  };

  const onChangePassword = async (event) => {
    event.preventDefault();

    if (!validateChangePassword()) return;

    if (!AUTH_URL) {
      setPasswordStatus({
        type: "error",
        message: "Auth service URL is not configured",
      });
      return;
    }

    if (!token) {
      setPasswordStatus({
        type: "error",
        message: "You are not logged in. Please login again.",
      });
      return;
    }

    try {
      setChangingPassword(true);
      setPasswordStatus({ type: "", message: "" });

      await axios.post(
        `${AUTH_URL}/change-password`,
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setPasswordStatus({
        type: "success",
        message: "Password changed successfully",
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setFieldErrors({});
      setShowPasswordForm(false);
    } catch (err) {
      const apiErrors = err?.response?.data?.errors;
      const validationMessage = Array.isArray(apiErrors)
        ? apiErrors[0]?.msg
        : "";

      setPasswordStatus({
        type: "error",
        message:
          validationMessage ||
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Password could not be changed. Please verify your details and try again.",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const onDeleteAccount = async () => {
    if (!AUTH_URL) {
      setProfileError("Auth service URL is not configured");
      return;
    }

    if (!token) {
      setProfileError("You are not logged in. Please login again.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone.",
    );

    if (!confirmed) return;

    try {
      setDeletingAccount(true);
      setProfileError("");

      await axios.delete(`${AUTH_URL}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      localStorage.removeItem("token");
      localStorage.removeItem("authUser");
      navigate("/register", { replace: true });
    } catch (err) {
      setProfileError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Account could not be deleted. Please try again.",
      );
    } finally {
      setDeletingAccount(false);
    }
  };

  return (
    <div className="user-panel-page user-profile-page">
      <section className="profile-card">
        <div className="profile-card-head">
          <div>
            <h1>Personal Information</h1>
            <p>Update your personal details</p>
          </div>

          <button
            type="button"
            className="profile-action-btn"
            onClick={fetchCurrentUser}
            disabled={loadingProfile}
          >
            {loadingProfile ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="profile-separator" />

        {loadingProfile ? (
          <p className="profile-muted">Loading profile details...</p>
        ) : profileError ? (
          <p className="profile-status profile-status--error">{profileError}</p>
        ) : (
          <div className="profile-grid">
            <label className="profile-field">
              <span>Full Name</span>
              <input type="text" value={profile.fullName} readOnly />
            </label>

            <label className="profile-field">
              <span>Username</span>
              <input type="text" value={profile.username} readOnly />
            </label>

            <label className="profile-field">
              <span>Email Address</span>
              <input type="email" value={profile.email} readOnly />
            </label>

            <label className="profile-field">
              <span>Address</span>
              <div className="profile-address-list">
                {loadingAddresses ? (
                  <p className="profile-address-empty">Loading addresses...</p>
                ) : addressesError ? (
                  <p className="profile-address-empty">{addressesError}</p>
                ) : addresses.length === 0 ? (
                  <p className="profile-address-empty">
                    No addresses added yet.
                  </p>
                ) : (
                  addresses.map((address, index) => (
                    <div
                      key={address?._id || `${address?.street}-${index}`}
                      className="profile-address-item"
                    >
                      <span>{formatAddress(address)}</span>
                      {address?.isDefault ? <small>Default</small> : null}
                    </div>
                  ))
                )}
              </div>
            </label>
          </div>
        )}

        <div className="profile-danger-zone">
          <button
            type="button"
            className="profile-danger-btn"
            onClick={onDeleteAccount}
            disabled={deletingAccount}
          >
            {deletingAccount ? "Deleting account..." : "Delete Account"}
          </button>
        </div>
      </section>

      <section className="profile-card">
        <div className="profile-card-head">
          <div>
            <h2>Change Password</h2>
          </div>

          <button
            type="button"
            className="profile-action-btn"
            onClick={() => {
              setShowPasswordForm((prev) => !prev);
              setPasswordStatus({ type: "", message: "" });
            }}
          >
            {showPasswordForm ? "Cancel" : "Change Password"}
          </button>
        </div>

        <div className="profile-separator" />

        {!showPasswordForm ? (
          <div>
            <p className="profile-password-mask">..............</p>
          </div>
        ) : (
          <form className="profile-password-form" onSubmit={onChangePassword}>
            <label className="profile-field">
              <span>Current Password</span>
              <input
                type="password"
                name="currentPassword"
                value={passwordForm.currentPassword}
                onChange={onPasswordInput}
                placeholder="Enter current password"
                className={
                  fieldErrors.currentPassword ? "profile-input-error" : ""
                }
              />
              {fieldErrors.currentPassword && (
                <small>{fieldErrors.currentPassword}</small>
              )}
            </label>

            <label className="profile-field">
              <span>New Password</span>
              <input
                type="password"
                name="newPassword"
                value={passwordForm.newPassword}
                onChange={onPasswordInput}
                placeholder="Enter new password"
                className={fieldErrors.newPassword ? "profile-input-error" : ""}
              />
              {fieldErrors.newPassword && (
                <small>{fieldErrors.newPassword}</small>
              )}
            </label>

            <label className="profile-field">
              <span>Confirm New Password</span>
              <input
                type="password"
                name="confirmPassword"
                value={passwordForm.confirmPassword}
                onChange={onPasswordInput}
                placeholder="Confirm new password"
                className={
                  fieldErrors.confirmPassword ? "profile-input-error" : ""
                }
              />
              {fieldErrors.confirmPassword && (
                <small>{fieldErrors.confirmPassword}</small>
              )}
            </label>

            <div className="profile-password-actions">
              <button type="submit" disabled={changingPassword}>
                {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        )}

        {passwordStatus.message && (
          <p
            className={`profile-status ${
              passwordStatus.type === "success"
                ? "profile-status--success"
                : "profile-status--error"
            }`}
          >
            {passwordStatus.message}
          </p>
        )}
      </section>
    </div>
  );
};

export default UserProfile;
