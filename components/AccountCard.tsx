"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { deleteAccount, type LoginStatus, loginStatus, logOut, saveName, setPassword } from "@/lib/account-client";
import { turnOffReminders } from "@/lib/push-client";

// On the Profile tab: log in to save everything, or see who's logged in. Hidden until login is set up.
export default function AccountCard() {
  const router = useRouter();
  const [status, setStatus] = useState<LoginStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [password, setPasswordText] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    loginStatus().then(setStatus);
  }, []);

  if (!status?.enabled) return null;

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }
    setBusy(true);
    setPasswordError(null);
    try {
      await setPassword(password);
      setStatus((current) => current && { ...current, hasPassword: true });
      setPasswordSaved(true);
      setEditingPassword(false);
      setPasswordText("");
    } catch (err) {
      setPasswordError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function saveNewName(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNameError(null);
    try {
      const name = await saveName(nameText);
      setStatus((current) => current && { ...current, name });
      setEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      // This phone stops asking for reminders too.
      await turnOffReminders().catch(() => {});
      router.push("/new?cleared=account");
    } catch (err) {
      setDeleteError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  async function confirmLogOut() {
    setBusy(true);
    await logOut().catch(() => {});
    router.push("/");
  }

  if (!status.email) {
    return (
      <section className="card account-card">
        <h2 className="section-title">Save everything to an account</h2>
        <p>
          Make a free account with your email to keep your plans, pantry, family answers and ratings, and use
          them on any phone or computer.
        </p>
        <Link href="/login?mode=signup&next=/more" className="primary">
          Sign up
        </Link>
        <Link href="/login?next=/more" className="secondary">
          I already have an account
        </Link>
        <Link href="/privacy" className="privacy-link">
          What we save and why
        </Link>
      </section>
    );
  }

  return (
    <section className="card account-card">
      <h2 className="section-title">Your account</h2>
      {editingName ? (
        <form className="password-form" onSubmit={saveNewName}>
          <label className="question" htmlFor="account-name">
            Your first name
          </label>
          <input
            id="account-name"
            type="text"
            autoComplete="given-name"
            maxLength={40}
            value={nameText}
            onChange={(event) => setNameText(event.target.value)}
          />
          <div className="confirm-buttons">
            <button type="submit" className="primary" disabled={busy || !nameText.trim()}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className="secondary" onClick={() => setEditingName(false)} disabled={busy}>
              Cancel
            </button>
          </div>
          {nameError && (
            <p className="error" role="alert">
              {nameError}
            </p>
          )}
        </form>
      ) : (
        <p className="account-name">
          {status.name ? (
            <>
              Hi, <strong>{status.name}</strong>!
            </>
          ) : (
            "Add your first name, and PlateWise will say hi at the top of the screen."
          )}{" "}
          <button
            type="button"
            className="link inline"
            onClick={() => {
              setNameText(status.name ?? "");
              setNameError(null);
              setEditingName(true);
            }}
          >
            {status.name ? "Change name" : "Add your name"}
          </button>
        </p>
      )}
      <p>
        Logged in as <strong>{status.email}</strong>. Your plans, pantry, family answers and ratings save to your
        account, so they show up on any device you log into.
      </p>
      {editingPassword ? (
        <form className="password-form" onSubmit={savePassword}>
          <input type="email" autoComplete="username" value={status.email} readOnly hidden />
          <label className="question" htmlFor="account-password">
            {status.hasPassword ? "New password" : "Password"}
          </label>
          <input
            id="account-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPasswordText(event.target.value)}
          />
          <p className="hint">At least 8 characters.</p>
          <div className="confirm-buttons">
            <button type="submit" className="primary" disabled={busy || !password}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button type="button" className="secondary" onClick={() => setEditingPassword(false)} disabled={busy}>
              Cancel
            </button>
          </div>
          {passwordError && (
            <p className="error" role="alert">
              {passwordError}
            </p>
          )}
        </form>
      ) : (
        <>
          {passwordSaved && (
            <p className="reminder-on">Password saved. Next time, log in with your email and password.</p>
          )}
          {!status.hasPassword && !passwordSaved && (
            <p className="hint">Make a password so you can log in on a new device without waiting for a code.</p>
          )}
          <button
            type="button"
            className="link left"
            onClick={() => {
              setEditingPassword(true);
              setPasswordSaved(false);
            }}
          >
            {status.hasPassword ? "Change password" : "Create a password"}
          </button>
        </>
      )}
      {confirming ? (
        <>
          <p className="hint">This takes your info off this device. It stays saved in your account.</p>
          <div className="confirm-buttons">
            <button type="button" className="secondary" onClick={confirmLogOut} disabled={busy}>
              {busy ? "Logging out…" : "Yes, log out"}
            </button>
            <button type="button" className="secondary" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="link left" onClick={() => setConfirming(true)}>
          Log out
        </button>
      )}
      <div className="delete-account">
        {confirmingDelete ? (
          <>
            <p>
              <strong>Delete your account?</strong> This deletes your name, email and password, your saved family
              answers, pantry and ratings, and every plan you made, including for anyone you shared it with. It
              can&apos;t be undone.
            </p>
            <div className="confirm-buttons">
              <button type="button" className="danger" onClick={confirmDelete} disabled={busy}>
                {busy ? "Deleting…" : "Yes, delete my account"}
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                Cancel
              </button>
            </div>
            {deleteError && (
              <p className="error" role="alert">
                {deleteError}
              </p>
            )}
          </>
        ) : (
          <button type="button" className="danger-link left" onClick={() => setConfirmingDelete(true)}>
            Delete my account
          </button>
        )}
        <Link href="/privacy" className="privacy-link">
          What we save and why
        </Link>
      </div>
    </section>
  );
}
