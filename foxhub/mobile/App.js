import { StatusBar } from "expo-status-bar";
import React, { useMemo, useState } from "react";
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
import {
  authenticate,
  buildInitialAccounts,
  getAccessLabel,
  hasFoxHubManagementAccess
} from "./src/foxhubMobileCore";
import { mobileScreens, mobileTabs } from "./src/foxhubMobileContent.generated";
import { defaultMobileThemeId, mobileThemes } from "./src/foxhubMobileThemes.generated";

const FOXHUB_WEB_APP_URL = "https://foxhub-superapp.web.app";

const blankDraft = {
  email: "",
  password: "",
  name: "",
  handle: "",
  city: "",
  zipCode: "",
  birthDate: "",
  inviteCode: "",
  sponsorHandle: ""
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

function AuthScreen({ styles, colors, route, mode, setRoute, setMode, draft, setDraft, onSubmit, error }) {
  const signingUp = mode === "signup";
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <View style={styles.mark}>
            <Text style={styles.markText}>FH</Text>
          </View>
          <View>
            <Text style={styles.eyebrow}>FoxHub Mobile</Text>
            <Text style={styles.title}>Trusted social, services, and operations.</Text>
          </View>
        </View>

        <Segment
          styles={styles}
          value={route}
          onChange={setRoute}
          options={[
            { value: "member", label: "Member" },
            { value: "management", label: "Management" }
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.form}>
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
            </>
          ) : null}
        </View>

        <Pressable style={styles.primaryButton} onPress={onSubmit}>
          <Text style={styles.primaryButtonText}>{signingUp ? "Create FoxHub profile" : "Open FoxHub"}</Text>
        </Pressable>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Smoke credentials</Text>
          <Text style={styles.demoText}>Member credentials must use the Member lane. Management credentials must use the Management lane.</Text>
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
          <Text style={styles.demoText}>Management: founder@foxhub.com / FoxHubFounder123</Text>
        </View>
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

function BrowserParityScreen({ styles }) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Browser parity</Text>
        <Text style={styles.screenTitle}>Open the real FoxHub web app.</Text>
        <Text style={styles.copy}>
          The hosted website blocks iframe embedding in the Expo web preview. On iOS and Android this tab uses a native WebView; in this browser preview, open the site directly.
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

function AppShell({ styles, colors, themeId, setThemeId, profile, accounts, onSignOut }) {
  const [activeTab, setActiveTab] = useState("browser");
  const [themeOpen, setThemeOpen] = useState(false);
  const visibleTabs = useMemo(
    () => [
      { id: "browser", label: "Browser" },
      ...mobileTabs.filter((tab) => !tab.managementOnly || hasFoxHubManagementAccess(profile))
    ],
    [profile]
  );
  const activeTheme = mobileThemes.find((theme) => theme.id === themeId) || mobileThemes[0];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.appHeader}>
        <View>
          <Text style={styles.eyebrow}>FoxHub</Text>
          <Text style={styles.headerTitle}>{profile.handle}</Text>
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
        {activeTab === "browser" ? (
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
  const [route, setRoute] = useState("member");
  const [mode, setMode] = useState("signin");
  const [draft, setDraft] = useState(blankDraft);
  const [error, setError] = useState("");
  const [themeId, setThemeId] = useState(defaultMobileThemeId);
  const theme = mobileThemes.find((item) => item.id === themeId) || mobileThemes[0];
  const colors = {
    ...defaultColors,
    ...theme.colors,
    green: theme.colors.green || theme.colors.accent,
    greenDark: theme.colors.accentStrong || theme.colors.accent,
    blue: theme.colors.green || theme.colors.accent,
    red: theme.colors.accentStrong || defaultColors.red
  };
  const styles = useMemo(() => createStyles(colors), [colors]);

  function submitAuth() {
    try {
      const result = authenticate({ accounts, route, mode, draft });
      setAccounts(result.accounts);
      setProfile(result.profile);
      setError("");
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : "Unable to authenticate.";
      setError(message);
      if (message === "Not Permitted.") Alert.alert("Not Permitted.", "This account cannot open that FoxHub lane.");
    }
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
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
        />
      </SafeAreaView>
    );
  }

  return <AppShell styles={styles} colors={colors} themeId={themeId} setThemeId={setThemeId} profile={profile} accounts={accounts} onSignOut={() => setProfile(null)} />;
}

const defaultColors = {
  ink: "#17211f",
  muted: "#5d6965",
  line: "#d8e0dd",
  bg: "#f6f8f6",
  panel: "#ffffff",
  green: "#216b49",
  greenDark: "#174832",
  gold: "#b7812f",
  red: "#a73b3b",
  blue: "#2d5f7a"
};

function createStyles(colors = defaultColors) {
return StyleSheet.create({
  flex: {
    flex: 1
  },
  safe: {
    flex: 1,
    backgroundColor: colors.bg
  },
  authPage: {
    padding: 20,
    gap: 16
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 8
  },
  mark: {
    width: 54,
    height: 54,
    borderRadius: 8,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center"
  },
  markText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 20
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    maxWidth: 280
  },
  segment: {
    flexDirection: "row",
    backgroundColor: "#e9eeeb",
    borderRadius: 8,
    padding: 4,
    gap: 4
  },
  segmentButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  segmentButtonActive: {
    backgroundColor: colors.panel
  },
  segmentText: {
    color: colors.muted,
    fontWeight: "700"
  },
  segmentTextActive: {
    color: colors.greenDark
  },
  form: {
    gap: 12
  },
  field: {
    gap: 6
  },
  fieldLabel: {
    color: colors.ink,
    fontWeight: "700"
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: colors.ink,
    backgroundColor: colors.panel
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "800"
  },
  secondaryButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryButtonText: {
    color: colors.greenDark,
    fontWeight: "800"
  },
  error: {
    color: colors.red,
    fontWeight: "800"
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
    backgroundColor: "#edf5f0",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 22,
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
    width: "31.8%",
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel
  },
  tabButtonActive: {
    backgroundColor: colors.greenDark,
    borderColor: colors.greenDark
  },
  themeBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    minHeight: 48
  },
  themeToggleButton: {
    minHeight: 42,
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
    color: "#fff"
  },
  tabText: {
    color: colors.muted,
    fontWeight: "800"
  },
  tabTextActive: {
    color: "#fff"
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
    padding: 14
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
    backgroundColor: "#edf5f0",
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
