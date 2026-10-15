import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { WebView } from "react-native-webview";
import Svg, { Path } from "react-native-svg";
import {
  authenticate,
  buildInitialAccounts,
  getAccessLabel,
  hasFoxHubManagementAccess
} from "./src/foxhubMobileCore";
import {
  FOXHUB_FIREBASE_PROJECT_ID,
  FOXHUB_WEB_APP_URL,
  createLiveProfile,
  signInLiveProfile,
  signOutLiveProfile,
  watchLiveAuth
} from "./src/foxhubMobileFirebase";
import { mobileScreens, mobileTabs } from "./src/foxhubMobileContent.generated";
import { defaultMobileThemeId, mobileThemes } from "./src/foxhubMobileThemes.generated";

const initialMobileThemeId = mobileThemes.some((theme) => theme.id === "dark") ? "dark" : defaultMobileThemeId;

const blankDraft = {
  email: "",
  password: "",
  name: "",
  handle: "",
  city: "",
  zipCode: "",
  birthDate: "",
  inviteCode: "",
  sponsorHandle: "",
  bio: ""
};

const demoCredentials = [
  {
    label: "Use member demo",
    route: "member",
    draft: {
      ...blankDraft,
      email: "member@example.com",
      password: "FoxHubMember123"
    }
  },
  {
    label: "Use management demo",
    route: "management",
    draft: {
      ...blankDraft,
      email: "founder@foxhub.com",
      password: "FoxHubFounder123"
    }
  }
];

function Field({ styles, colors, label, value, onChangeText, placeholder, secureTextEntry, keyboardType }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
      />
    </View>
  );
}

function Segment({ styles, value, options, onChange }) {
  return (
    <View style={styles.segment}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          style={[styles.segmentButton, value === option.value && styles.segmentButtonActive]}
          onPress={() => onChange(option.value)}
        >
          <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Metric({ styles, label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ValueChip({ styles, label, detail }) {
  return (
    <View style={styles.valueChip}>
      <Text style={styles.valueChipLabel}>{label}</Text>
      <Text style={styles.valueChipDetail}>{detail}</Text>
    </View>
  );
}

function FoxMark({ styles }) {
  return (
    <View style={styles.logoMark}>
      <Svg width="52" height="52" viewBox="0 0 64 64" accessibilityLabel="FoxHub logo">
        <Path fill={styles.logoMainColor.color} d="M10 8l15 9 7-5 7 5 15-9-5 22 4 11-21 15-21-15 4-11L10 8z" />
        <Path fill={styles.logoCutoutColor.color} d="M19 25l9 4-7 6-5-2 3-8zm26 0l3 8-5 2-7-6 9-4zM25 39h14l-7 7-7-7z" />
        <Path fill={styles.logoNoseColor.color} d="M28 36h8l-4 5-4-5z" />
      </Svg>
    </View>
  );
}

function AuthScreen({ styles, colors, route, mode, setRoute, setMode, draft, setDraft, onSubmit, error, backendMode, setBackendMode, busy }) {
  const signingUp = mode === "signup";
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
        <View style={styles.authHero}>
          <View style={styles.scanLine} />
          <View style={styles.brandRow}>
            <FoxMark styles={styles} />
            <View style={styles.brandCopy}>
              <Text style={styles.eyebrow}>FoxHub Android</Text>
              <Text style={styles.title}>Your same FoxHub, tuned for your phone.</Text>
            </View>
          </View>
          <View style={styles.heroOfferRow}>
            <ValueChip styles={styles} label="Same login" detail="Web + Android" />
            <ValueChip styles={styles} label="Live profile" detail="Shared records" />
            <ValueChip styles={styles} label="Night ready" detail="Theme aware" />
          </View>
          <View style={styles.syncPanel}>
            <View style={styles.syncNode}>
              <Text style={styles.syncNodeTitle}>Website</Text>
              <Text style={styles.syncNodeDetail}>foxhub-c984b</Text>
            </View>
            <View style={styles.syncBeam} />
            <View style={styles.syncNode}>
              <Text style={styles.syncNodeTitle}>User database</Text>
              <Text style={styles.syncNodeDetail}>one account</Text>
            </View>
            <View style={styles.syncBeam} />
            <View style={styles.syncNode}>
              <Text style={styles.syncNodeTitle}>Android</Text>
              <Text style={styles.syncNodeDetail}>same profile</Text>
            </View>
          </View>
        </View>

        <View style={styles.statusPanel}>
          <View>
            <Text style={styles.statusLabel}>Connection</Text>
            <Text style={styles.statusValue}>{backendMode === "live" ? "Same user database as the site" : "Try the sample mode"}</Text>
          </View>
          <Text style={styles.statusPill}>{backendMode === "live" ? "Synced" : "Sample"}</Text>
        </View>

        <View style={styles.controlPanel}>
          <Segment
            styles={styles}
            value={backendMode}
            onChange={setBackendMode}
            options={[
              { value: "live", label: "Real account" },
              { value: "demo", label: "Sample" }
            ]}
          />
          <Segment
            styles={styles}
            value={route}
            onChange={setRoute}
            options={[
              { value: "member", label: "Member" },
              { value: "management", label: "Staff" }
            ]}
          />
          <Segment
            styles={styles}
            value={mode}
            onChange={setMode}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Sign up" }
            ]}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.formPanel}>
          <View style={styles.formHead}>
            <Text style={styles.panelTitle}>{signingUp ? "Create your profile" : "Open your profile"}</Text>
            <Text style={styles.copy}>{signingUp ? "Start with your name, city, and invite if you have one." : "Use the same email and password as the FoxHub website."}</Text>
          </View>
          <Field styles={styles} colors={colors} label="Email" value={draft.email} onChangeText={(email) => setDraft({ ...draft, email })} placeholder="you@example.com" keyboardType="email-address" />
          <Field styles={styles} colors={colors} label="Password" value={draft.password} onChangeText={(password) => setDraft({ ...draft, password })} placeholder="Password" secureTextEntry />

          {signingUp ? (
            <>
              <Field styles={styles} colors={colors} label="Public display name" value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} placeholder="Your public name" />
              <Field styles={styles} colors={colors} label="Handle" value={draft.handle} onChangeText={(handle) => setDraft({ ...draft, handle })} placeholder="@handle" />
              <Field styles={styles} colors={colors} label="City" value={draft.city} onChangeText={(city) => setDraft({ ...draft, city })} placeholder="City" />
              <Field styles={styles} colors={colors} label="ZIP code" value={draft.zipCode} onChangeText={(zipCode) => setDraft({ ...draft, zipCode })} placeholder="30301" keyboardType="number-pad" />
              <Field styles={styles} colors={colors} label="Birth date" value={draft.birthDate} onChangeText={(birthDate) => setDraft({ ...draft, birthDate })} placeholder="YYYY-MM-DD" />
              <Field styles={styles} colors={colors} label="Invite code" value={draft.inviteCode} onChangeText={(inviteCode) => setDraft({ ...draft, inviteCode })} placeholder="Optional sponsor code" />
              <Field styles={styles} colors={colors} label="Personal note" value={draft.bio} onChangeText={(bio) => setDraft({ ...draft, bio })} placeholder="What should your circle know first?" />
            </>
          ) : null}
        </View>

        <Pressable style={[styles.primaryButton, busy && styles.buttonDisabled]} onPress={onSubmit} disabled={busy}>
          <Text style={styles.primaryButtonText}>{busy ? "Connecting..." : signingUp ? "Create FoxHub profile" : "Open FoxHub"}</Text>
        </Pressable>

        <View style={styles.promisePanel}>
          <Text style={styles.promiseTitle}>One signup, more ways to use FoxHub</Text>
          <Text style={styles.promiseText}>Sign in once and use the same FoxHub profile, circles, staff access, and activity records on the website or Android app.</Text>
        </View>

        {backendMode === "demo" ? <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Smoke credentials</Text>
          <Text style={styles.demoText}>Sample member accounts open the Member side. Sample staff accounts open the Staff side.</Text>
          <View style={styles.demoActions}>
            {demoCredentials.map((credential) => (
              <Pressable
                key={credential.label}
                style={styles.demoButton}
                onPress={() => {
                  setRoute(credential.route);
                  setMode("signin");
                  setDraft(credential.draft);
                }}
              >
                <Text style={styles.demoButtonText}>{credential.label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.demoText}>Member: member@example.com / FoxHubMember123</Text>
          <Text style={styles.demoText}>Staff: founder@foxhub.com / FoxHubFounder123</Text>
        </View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ContentCard({ styles, item }) {
  return (
    <View style={styles.rowPanel}>
      <View style={styles.cardText}>
        <Text style={styles.panelTitle}>{item.title || item.name || item.label}</Text>
        <Text style={styles.copy}>{item.detail}</Text>
        {item.meta ? <Text style={styles.metaLine}>{item.meta}</Text> : null}
      </View>
      {item.badge || item.value || item.trust ? <Text style={styles.badge}>{item.badge || item.value || item.trust}</Text> : null}
    </View>
  );
}

function ContentSection({ styles, section }) {
  return (
    <View style={styles.panel}>
      <View style={styles.sectionHead}>
        <Text style={styles.panelTitle}>{section.title}</Text>
        <Text style={styles.sectionCount}>{section.data.length}</Text>
      </View>
      <View style={styles.stack}>
        {section.data.map((item, index) => (
          <ContentCard key={`${section.title}-${item.title || item.name || item.label}-${index}`} styles={styles} item={item} />
        ))}
      </View>
    </View>
  );
}

function WebsiteScreen({ styles, screenId, profile, accounts }) {
  const screen = mobileScreens[screenId] || mobileScreens.hub;
  return (
    <View style={styles.stack}>
      <View style={styles.heroPanel}>
        <Text style={styles.eyebrow}>{screen.eyebrow}</Text>
        <Text style={styles.screenTitle}>{screen.title}</Text>
        <Text style={styles.copy}>{screen.summary}</Text>
      </View>
      <View style={styles.metricsGrid}>
        <Metric styles={styles} label="Signed in" value={getAccessLabel(profile)} />
        <Metric styles={styles} label="Accounts" value={Object.keys(accounts).length} />
      </View>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Current profile</Text>
        <Text style={styles.profileLine}>{profile.displayName || profile.name} · {profile.handle}</Text>
        <Text style={styles.copy}>{profile.accessNote}</Text>
      </View>
      {screen.sections.map((section) => (
        <ContentSection key={`${screenId}-${section.title}`} styles={styles} section={section} />
      ))}
    </View>
  );
}

function TodayScreen({ styles, profile, setActiveTab }) {
  const stats = profile.mobileStats || {};
  const quickActions = [
    { label: "Social", tab: "chat", detail: "Threads and moments" },
    { label: "Rapport", tab: "circles", detail: "People and trust" },
    { label: "Services", tab: "discover", detail: "Needs and listings" },
    { label: "Pay", tab: "wallet", detail: "Wallet context" }
  ];
  if (hasFoxHubManagementAccess(profile)) {
    quickActions.push({ label: "Ops", tab: "management", detail: "Staff controls" });
  }

  return (
    <View style={styles.stack}>
      <View style={styles.todayHero}>
        <View style={styles.heroTopLine}>
          <Text style={styles.heroKicker}>Today</Text>
          <Text style={styles.liveDot}>Ready</Text>
        </View>
        <Text style={styles.todayTitle}>Hi, {profile.displayName || profile.name}.</Text>
        <Text style={styles.todayCopy}>Your people, local asks, profile, and helpful tools in one phone-first home.</Text>
        <View style={styles.heroOfferRow}>
          <ValueChip styles={styles} label={getAccessLabel(profile)} detail="Access lane" />
          <ValueChip styles={styles} label={profile.city || "Local"} detail="Home base" />
          <ValueChip styles={styles} label="Shared DB" detail="Website match" />
        </View>
      </View>
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <Pressable key={action.tab} style={styles.quickTile} onPress={() => setActiveTab(action.tab)}>
            <Text style={styles.quickIcon}>{action.label.slice(0, 1)}</Text>
            <Text style={styles.quickLabel}>{action.label}</Text>
            <Text style={styles.quickDetail}>{action.detail}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.metricsGrid}>
        <Metric styles={styles} label="Contacts" value={stats.contacts ?? 0} />
        <Metric styles={styles} label="Threads" value={stats.threads ?? 0} />
      </View>
      <View style={styles.metricsGrid}>
        <Metric styles={styles} label="Moments" value={stats.moments ?? 0} />
        <Metric styles={styles} label="Wallet" value={stats.walletEvents ?? 0} />
      </View>
      <View style={styles.panel}>
        <View style={styles.oneIdHeader}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{String(profile.displayName || profile.name || "FH").slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={styles.panelTitle}>Your profile card</Text>
            <Text style={styles.profileLine}>{profile.handle} · {profile.city || "City pending"}</Text>
          </View>
        </View>
        <Text style={styles.copy}>{profile.accessNote}</Text>
        <Text style={styles.metaLine}>Same FoxHub user database as the website: {profile.email}</Text>
      </View>
    </View>
  );
}

function BrowserParityScreen({ styles }) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Browser parity</Text>
        <Text style={styles.screenTitle}>Open the real FoxHub web app.</Text>
        <Text style={styles.copy}>
          The Android build opens the full FoxHub website inside the app. In this browser preview, open the site directly.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => Linking.openURL(FOXHUB_WEB_APP_URL)}>
          <Text style={styles.primaryButtonText}>Open FoxHub Website</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.browserFrame}>
      <WebView
        source={{ uri: FOXHUB_WEB_APP_URL }}
        originWhitelist={["https://*", "http://*"]}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
      />
    </View>
  );
}

function AppShell({ styles, colors, themeId, setThemeId, profile, accounts, onSignOut, backendMode, statusBarStyle }) {
  const [activeTab, setActiveTab] = useState("today");
  const [themeOpen, setThemeOpen] = useState(false);
  const visibleTabs = useMemo(
    () => [
      { id: "today", label: "Today" },
      { id: "browser", label: "Browser" },
      ...mobileTabs.filter((tab) => !tab.managementOnly || hasFoxHubManagementAccess(profile))
    ],
    [profile]
  );
  const activeTheme = mobileThemes.find((theme) => theme.id === themeId) || mobileThemes[0];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.appHeader}>
        <View style={styles.appIdentity}>
          <View style={styles.avatarMini}>
            <Text style={styles.avatarMiniText}>{String(profile.displayName || profile.name || "FH").slice(0, 2).toUpperCase()}</Text>
          </View>
          <View>
          <Text style={styles.eyebrow}>{backendMode === "live" ? "FoxHub" : "FoxHub Sample"}</Text>
          <Text style={styles.headerTitle}>{profile.handle}</Text>
          </View>
        </View>
        <Pressable style={styles.secondaryButton} onPress={onSignOut}>
          <Text style={styles.secondaryButtonText}>Sign out</Text>
        </Pressable>
      </View>
      <View style={styles.themeBar}>
        <Pressable style={styles.themeToggleButton} onPress={() => setThemeOpen((open) => !open)}>
          <View style={[styles.themeSwatch, { backgroundColor: activeTheme.colors.accent, borderColor: activeTheme.colors.lineStrong }]} />
          <Text style={styles.themeToggleText}>Theme: {activeTheme.label}</Text>
          <Text style={styles.themeCaret}>{themeOpen ? "Close" : "Open"}</Text>
        </Pressable>
      </View>
      {themeOpen ? (
        <View style={styles.themeDropdown}>
          <ScrollView nestedScrollEnabled contentContainerStyle={styles.themeDropdownContent}>
            {mobileThemes.map((theme) => (
              <Pressable
                key={theme.id}
                style={[styles.themeOption, themeId === theme.id && styles.themeOptionActive]}
                onPress={() => {
                  setThemeId(theme.id);
                  setThemeOpen(false);
                }}
              >
                <View style={[styles.themeSwatch, { backgroundColor: theme.colors.accent, borderColor: theme.colors.lineStrong }]} />
                <Text style={[styles.themeOptionText, themeId === theme.id && styles.themeOptionTextActive]}>{theme.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      <View style={styles.tabBar}>
        {visibleTabs.map((tab) => (
          <Pressable key={tab.id} style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]} onPress={() => setActiveTab(tab.id)}>
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === "today" ? (
          <TodayScreen styles={styles} profile={profile} setActiveTab={setActiveTab} />
        ) : activeTab === "browser" ? (
          <BrowserParityScreen styles={styles} />
        ) : (
          <WebsiteScreen styles={styles} screenId={activeTab} profile={profile} accounts={accounts} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [accounts, setAccounts] = useState(() => buildInitialAccounts());
  const [profile, setProfile] = useState(null);
  const [backendMode, setBackendMode] = useState("live");
  const [route, setRoute] = useState("member");
  const [mode, setMode] = useState("signin");
  const [draft, setDraft] = useState(blankDraft);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [themeId, setThemeId] = useState(initialMobileThemeId);
  const theme = mobileThemes.find((item) => item.id === themeId) || mobileThemes[0];
  const colors = {
    ...defaultColors,
    ...theme.colors,
    green: theme.colors.green || theme.colors.accent,
    greenDark: theme.colors.accent || theme.colors.green || defaultColors.greenDark,
    blue: theme.colors.soft || theme.colors.green || theme.colors.accent,
    red: theme.colors.accentStrong || defaultColors.red
  };
  const isDarkTheme = String(colors.bg || "").toLowerCase().startsWith("#0") || String(colors.bg || "").toLowerCase().startsWith("#1") || String(colors.bg || "").toLowerCase().startsWith("#2");
  const statusBarStyle = isDarkTheme ? "light" : "dark";
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (backendMode !== "live") {
      setBooting(false);
      return undefined;
    }
    setBooting(true);
    const unsubscribe = watchLiveAuth(
      (liveProfile) => {
        setProfile(liveProfile);
        setBooting(false);
      },
      (message) => {
        setError(message);
        setBooting(false);
      }
    );
    return unsubscribe;
  }, [backendMode]);

  async function submitAuth() {
    if (busy) return;
    setBusy(true);
    try {
      if (backendMode === "live") {
        const liveProfile = mode === "signup" ? await createLiveProfile({ route, draft }) : await signInLiveProfile({ route, draft });
        setProfile(liveProfile);
      } else {
        const result = authenticate({ accounts, route, mode, draft });
        setAccounts(result.accounts);
        setProfile(result.profile);
      }
      setError("");
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Unable to authenticate.";
      setError(message);
      if (message === "Not Permitted.") Alert.alert("Not Permitted.", "This account cannot open that FoxHub lane.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (backendMode === "live") {
      try {
        await signOutLiveProfile();
      } catch (signOutError) {
        setError(signOutError instanceof Error ? signOutError.message : "Unable to sign out.");
      }
    }
    setProfile(null);
  }

  if (booting && backendMode === "live") {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={statusBarStyle} />
        <View style={styles.loadingPage}>
          <FoxMark styles={styles} />
          <Text style={styles.title}>Opening FoxHub Mobile</Text>
          <Text style={styles.copy}>Getting your FoxHub account ready.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style={statusBarStyle} />
        <AuthScreen
          styles={styles}
          colors={colors}
          route={route}
          mode={mode}
          setRoute={setRoute}
          setMode={setMode}
          draft={draft}
          setDraft={setDraft}
          onSubmit={submitAuth}
          error={error}
          backendMode={backendMode}
          setBackendMode={setBackendMode}
          busy={busy}
        />
      </SafeAreaView>
    );
  }

  return <AppShell styles={styles} colors={colors} themeId={themeId} setThemeId={setThemeId} profile={profile} accounts={accounts} onSignOut={handleSignOut} backendMode={backendMode} statusBarStyle={statusBarStyle} />;
}

const defaultColors = {
  ink: "#17211f",
  muted: "#5d6965",
  line: "#d8e0dd",
  bg: "#eef7f0",
  panel: "#ffffff",
  green: "#216b49",
  greenDark: "#174832",
  gold: "#b7812f",
  red: "#a73b3b",
  blue: "#2d5f7a"
};

function createStyles(colors = defaultColors) {
const accentSoft = colors.accentSoft || "#edf5f0";
const layer = colors.layer || "#e9f2ec";
const panelAlt = colors.panelAlt || colors.panel;
const softText = colors.soft || colors.ink;
const bgHex = String(colors.bg || "").toLowerCase();
const isDarkTheme = bgHex.startsWith("#0") || bgHex.startsWith("#1") || bgHex.startsWith("#2");
const onAccent = isDarkTheme ? "#06120d" : "#ffffff";
const fieldBg = panelAlt;
const subtlePanel = isDarkTheme ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.64)";
const floatingPanel = isDarkTheme ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.76)";
const errorBg = isDarkTheme ? "rgba(240,90,90,0.14)" : "#fff5f3";
return StyleSheet.create({
  flex: {
    flex: 1
  },
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  authPage: {
    padding: 18,
    paddingTop: 24,
    gap: 12
  },
  loadingPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 4
  },
  authHero: {
    borderRadius: 8,
    backgroundColor: isDarkTheme ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: colors.lineStrong || colors.line,
    padding: 14,
    gap: 16
  },
  scanLine: {
    height: 3,
    borderRadius: 8,
    backgroundColor: colors.accent || colors.green,
    opacity: 0.9
  },
  brandCopy: {
    flex: 1
  },
  mark: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: colors.accent || colors.greenDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lineStrong || colors.line
  },
  markText: {
    color: onAccent,
    fontWeight: "900",
    fontSize: 25
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.lineStrong || colors.line,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  logoMainColor: {
    color: colors.accent || colors.green
  },
  logoCutoutColor: {
    color: colors.panelAlt || colors.bg
  },
  logoNoseColor: {
    color: colors.ink
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    maxWidth: 300
  },
  heroOfferRow: {
    flexDirection: "row",
    gap: 8
  },
  valueChip: {
    flex: 1,
    minHeight: 58,
    borderRadius: 8,
    backgroundColor: accentSoft,
    borderWidth: 1,
    borderColor: colors.lineStrong || colors.line,
    padding: 9,
    justifyContent: "center"
  },
  syncPanel: {
    minHeight: 78,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.lineStrong || colors.line,
    backgroundColor: isDarkTheme ? "rgba(101,214,159,0.08)" : "rgba(22,130,79,0.08)",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  syncNode: {
    flex: 1,
    minHeight: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: floatingPanel,
    padding: 8,
    justifyContent: "center"
  },
  syncNodeTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "900"
  },
  syncNodeDetail: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2
  },
  syncBeam: {
    width: 14,
    height: 2,
    borderRadius: 4,
    backgroundColor: colors.accent || colors.green
  },
  valueChipLabel: {
    color: colors.accent || colors.greenDark,
    fontWeight: "900",
    fontSize: 13
  },
  valueChipDetail: {
    color: softText,
    fontWeight: "700",
    fontSize: 11,
    marginTop: 2
  },
  segment: {
    flexDirection: "row",
    backgroundColor: layer,
    borderRadius: 8,
    padding: 4,
    gap: 4
  },
  segmentButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  segmentText: {
    color: colors.muted,
    fontWeight: "900"
  },
  segmentTextActive: {
    color: colors.greenDark
  },
  form: {
    gap: 12
  },
  statusPanel: {
    minHeight: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: floatingPanel,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  statusLabel: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  statusValue: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 16,
    marginTop: 3
  },
  statusPill: {
    color: colors.accent || colors.greenDark,
    backgroundColor: accentSoft,
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "900"
  },
  controlPanel: {
    gap: 10,
    borderRadius: 8,
    backgroundColor: "transparent",
    borderWidth: 0,
    padding: 0
  },
  formPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: floatingPanel,
    padding: 14,
    gap: 12
  },
  formHead: {
    gap: 4,
    paddingBottom: 2
  },
  field: {
    gap: 6
  },
  fieldLabel: {
    color: colors.ink,
    fontWeight: "700"
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 14,
    color: colors.ink,
    backgroundColor: fieldBg,
    fontWeight: "700"
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 8,
    backgroundColor: colors.accent || colors.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lineStrong || colors.greenDark
  },
  primaryButtonText: {
    color: onAccent,
    fontWeight: "900",
    fontSize: 16
  },
  buttonDisabled: {
    opacity: 0.64
  },
  secondaryButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel
  },
  secondaryButtonText: {
    color: colors.greenDark,
    fontWeight: "800"
  },
  error: {
    color: colors.red,
    fontWeight: "900",
    backgroundColor: errorBg,
    borderWidth: 1,
    borderColor: "#f0c5bd",
    borderRadius: 8,
    padding: 10
  },
  promisePanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "transparent",
    padding: 14,
    gap: 5
  },
  promiseTitle: {
    color: colors.accent || colors.ink,
    fontWeight: "900",
    fontSize: 16
  },
  promiseText: {
    color: softText,
    fontWeight: "700",
    lineHeight: 20
  },
  demoBox: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    padding: 12,
    backgroundColor: colors.panel
  },
  demoTitle: {
    color: colors.ink,
    fontWeight: "800",
    marginBottom: 4
  },
  demoText: {
    color: colors.muted,
    lineHeight: 20
  },
  demoActions: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 10
  },
  demoButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: accentSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  demoButtonText: {
    color: colors.greenDark,
    fontWeight: "900",
    textAlign: "center"
  },
  appHeader: {
    padding: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  appIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "800"
  },
  tabBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10
  },
  tabButton: {
    width: "31.5%",
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: floatingPanel
  },
  tabButtonActive: {
    backgroundColor: colors.accent || colors.greenDark,
    borderColor: colors.lineStrong || colors.greenDark
  },
  themeBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    minHeight: 48
  },
  themeToggleButton: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  themeToggleText: {
    color: colors.ink,
    fontWeight: "900",
    flex: 1
  },
  themeCaret: {
    color: colors.greenDark,
    fontWeight: "900",
    fontSize: 12
  },
  themeDropdown: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    maxHeight: 220
  },
  themeDropdownContent: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    backgroundColor: colors.panel,
    overflow: "hidden"
  },
  themeOption: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: "transparent",
    borderBottomColor: colors.line,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  themeOptionActive: {
    backgroundColor: colors.greenDark,
    borderColor: colors.greenDark
  },
  themeSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1
  },
  themeOptionText: {
    color: colors.muted,
    fontWeight: "800",
    flex: 1
  },
  themeOptionTextActive: {
    color: onAccent
  },
  tabText: {
    color: colors.muted,
    fontWeight: "800"
  },
  tabTextActive: {
    color: onAccent
  },
  content: {
    padding: 16,
    paddingBottom: 40
  },
  browserFrame: {
    height: 680,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    backgroundColor: colors.panel
  },
  stack: {
    gap: 12
  },
  heroPanel: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 8
  },
  todayHero: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    gap: 12
  },
  heroTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  heroKicker: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  liveDot: {
    color: colors.accent || colors.ink,
    backgroundColor: accentSoft,
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontWeight: "900",
    fontSize: 12
  },
  todayTitle: {
    color: colors.ink,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900"
  },
  todayCopy: {
    color: softText,
    lineHeight: 21,
    fontWeight: "700"
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  quickTile: {
    width: "48.4%",
    minHeight: 112,
    backgroundColor: colors.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 13,
    justifyContent: "space-between"
  },
  quickIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    overflow: "hidden",
    textAlign: "center",
    lineHeight: 30,
    color: onAccent,
    backgroundColor: colors.accent || colors.greenDark,
    fontWeight: "900"
  },
  quickLabel: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 18
  },
  quickDetail: {
    color: colors.muted,
    fontWeight: "700"
  },
  screenTitle: {
    color: colors.ink,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900"
  },
  copy: {
    color: colors.muted,
    lineHeight: 21
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 12
  },
  metric: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 14,
    minHeight: 82
  },
  metricValue: {
    color: colors.blue,
    fontSize: 22,
    fontWeight: "900"
  },
  metricLabel: {
    color: colors.muted,
    marginTop: 4
  },
  panel: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    gap: 8
  },
  rowPanel: {
    backgroundColor: colors.panel,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  cardText: {
    flex: 1,
    gap: 5
  },
  oneIdHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  avatarMini: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: colors.accent || colors.greenDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lineStrong || colors.line
  },
  avatarMiniText: {
    color: onAccent,
    fontWeight: "900"
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  sectionCount: {
    color: colors.gold,
    fontWeight: "900"
  },
  panelTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  badge: {
    alignSelf: "flex-start",
    maxWidth: 96,
    backgroundColor: accentSoft,
    color: colors.greenDark,
    borderRadius: 6,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontWeight: "900",
    textAlign: "center"
  },
  metaLine: {
    color: colors.blue,
    fontWeight: "800",
    fontSize: 12,
    lineHeight: 17
  },
  profileLine: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700"
  }
});
}
