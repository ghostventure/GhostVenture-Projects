import SwiftUI

struct RootView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var selectedTab = 0
    @State private var activeSheet: QuickSheet?

    var body: some View {
        Group {
            if store.isRestoring {
                ProgressView("Opening OverHead…")
                    .tint(OverHeadStyle.blue)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(OverHeadStyle.canvas.ignoresSafeArea())
            } else if store.isSignedIn {
                workspaceTabs
            } else {
                SignInView()
            }
        }
        .environment(store)
        .task { await store.restoreSession() }
        .alert("OverHead", isPresented: Binding(
            get: { store.errorMessage != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) { store.errorMessage = nil }
        } message: {
            Text(store.errorMessage ?? "")
        }
    }

    private var workspaceTabs: some View {
        TabView(selection: $selectedTab) {
            TodayView(activeSheet: $activeSheet)
                .tabItem { Label("Today", systemImage: "sun.max") }
                .tag(0)
            CustomersView()
                .tabItem { Label("Customers", systemImage: "person.2") }
                .tag(1)
            ApprovalsView()
                .tabItem { Label("Approvals", systemImage: "checkmark.seal") }
                .tag(2)
                .badge(store.pendingApprovalCount)
            ActivityView()
                .tabItem { Label("Activity", systemImage: "clock.arrow.circlepath") }
                .tag(3)
        }
        .tint(OverHeadStyle.ink)
        .sheet(item: $activeSheet) { sheet in
            if sheet.id == QuickSheet.task.id {
                AddTaskSheet()
            } else {
                QuickNoteSheet()
            }
        }
    }
}

struct QuickSheet: Identifiable {
    let id: String
    static let task = QuickSheet(id: "task")
    static let note = QuickSheet(id: "note")
}

private struct SignInView: View {
    @Environment(OverHeadStore.self) private var store
    @State private var email = ""
    @State private var password = ""
    @FocusState private var passwordFocused: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 10) {
                        Image(systemName: "square.grid.2x2.fill")
                            .font(.system(size: 23, weight: .semibold))
                            .foregroundStyle(.white)
                            .frame(width: 54, height: 54)
                            .background(OverHeadStyle.blue, in: RoundedRectangle(cornerRadius: 16))
                        Text("A little less overhead.")
                            .font(.system(size: 30, weight: .bold, design: .rounded))
                            .foregroundStyle(OverHeadStyle.ink)
                        Text("Sign in with your OverHead team account to see today’s work.")
                            .font(.system(size: 15))
                            .foregroundStyle(OverHeadStyle.muted)
                    }

                    VStack(alignment: .leading, spacing: 15) {
                        VStack(alignment: .leading, spacing: 7) {
                            Text("EMAIL").font(.system(size: 11, weight: .bold)).tracking(0.8).foregroundStyle(OverHeadStyle.muted)
                            TextField("you@business.com", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .submitLabel(.next)
                                .onSubmit { passwordFocused = true }
                                .padding(14)
                                .background(.white, in: RoundedRectangle(cornerRadius: 13))
                                .overlay(RoundedRectangle(cornerRadius: 13).stroke(OverHeadStyle.line, lineWidth: 1))
                        }
                        VStack(alignment: .leading, spacing: 7) {
                            Text("PASSWORD").font(.system(size: 11, weight: .bold)).tracking(0.8).foregroundStyle(OverHeadStyle.muted)
                            SecureField("Your OverHead password", text: $password)
                                .textContentType(.password)
                                .focused($passwordFocused)
                                .submitLabel(.go)
                                .onSubmit(signIn)
                                .padding(14)
                                .background(.white, in: RoundedRectangle(cornerRadius: 13))
                                .overlay(RoundedRectangle(cornerRadius: 13).stroke(OverHeadStyle.line, lineWidth: 1))
                        }

                        Button(action: signIn) {
                            HStack {
                                Spacer()
                                if store.isLoading { ProgressView().tint(.white) }
                                else { Text("Sign in").font(.system(size: 16, weight: .semibold)) }
                                Spacer()
                            }
                            .foregroundStyle(.white)
                            .padding(15)
                            .background(OverHeadStyle.blue, in: RoundedRectangle(cornerRadius: 14))
                        }
                        .disabled(store.isLoading || email.isEmpty || password.isEmpty)

                        Button("Forgot password?") {
                            Task { await store.sendPasswordReset(to: email) }
                        }
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(OverHeadStyle.blue)
                        .frame(maxWidth: .infinity)
                        .disabled(store.isLoading)
                    }
                    .padding(18)
                    .background(.white.opacity(0.75), in: RoundedRectangle(cornerRadius: 20))

                    Text("Your workspace records stay protected by your OverHead team role.")
                        .font(.system(size: 12))
                        .foregroundStyle(OverHeadStyle.muted)
                        .frame(maxWidth: .infinity)
                        .multilineTextAlignment(.center)
                }
                .padding(22)
            }
            .background(OverHeadStyle.canvas.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
        }
    }

    private func signIn() {
        Task { await store.signIn(email: email, password: password) }
    }
}

private struct TodayView: View {
    @Environment(OverHeadStore.self) private var store
    @Binding var activeSheet: QuickSheet?
    @State private var taskFilter: TaskFilter = .open

    private var visibleTasks: [QuickTask] {
        switch taskFilter {
        case .open: store.tasks.filter { !$0.done }
        case .completed: store.tasks.filter(\.done)
        case .all: store.tasks
        }
    }

    private var dateTitle: String {
        Date.now.formatted(.dateTime.weekday(.wide).month(.wide).day())
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    HStack(spacing: 8) {
                        Circle().fill(OverHeadStyle.green).frame(width: 8, height: 8)
                        Text(store.businessName.uppercased())
                            .font(.system(size: 11, weight: .bold, design: .rounded))
                            .tracking(1.15)
                            .foregroundStyle(OverHeadStyle.muted)
                            .lineLimit(1)
                        Spacer(minLength: 4)
                        Menu {
                            Text(store.displayName)
                            Text(store.role)
                            Divider()
                            Button("Refresh workspace", systemImage: "arrow.clockwise") { Task { await store.refresh() } }
                            Button("Sign out", systemImage: "rectangle.portrait.and.arrow.right", role: .destructive) { store.signOut() }
                        } label: {
                            Image(systemName: "person.crop.circle.fill")
                                .font(.system(size: 29))
                                .foregroundStyle(OverHeadStyle.ink.opacity(0.75))
                        }
                    }

                    VStack(alignment: .leading, spacing: 5) {
                        Text("A little less overhead.")
                            .font(.system(size: 29, weight: .bold, design: .rounded))
                            .foregroundStyle(OverHeadStyle.ink)
                        Text(dateTitle)
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(OverHeadStyle.muted)
                    }

                    HStack(spacing: 12) {
                        MetricCard(value: "\(store.openTaskCount)", title: "Open tasks", icon: "checklist", tint: OverHeadStyle.blue)
                        MetricCard(value: "\(store.followUpCount)", title: "Follow-ups", icon: "arrowshape.turn.up.right", tint: OverHeadStyle.orange)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Quick actions")
                                .font(.system(size: 19, weight: .bold, design: .rounded))
                                .foregroundStyle(OverHeadStyle.ink)
                            Spacer()
                            Text("A few taps, done")
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(OverHeadStyle.muted)
                        }
                        HStack(spacing: 10) {
                            QuickActionButton(title: "Add a task", icon: "plus", tint: OverHeadStyle.blue) { activeSheet = .task }
                            QuickActionButton(title: "Log an update", icon: "square.and.pencil", tint: OverHeadStyle.green) { activeSheet = .note }
                        }
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("Your tasks")
                                .font(.system(size: 19, weight: .bold, design: .rounded))
                                .foregroundStyle(OverHeadStyle.ink)
                            Spacer()
                            if store.isLoading { ProgressView().controlSize(.small) }
                            else { Text("\(store.openTaskCount) open").font(.system(size: 12, weight: .semibold)).foregroundStyle(OverHeadStyle.muted) }
                        }
                        Picker("Task filter", selection: $taskFilter) {
                            ForEach(TaskFilter.allCases) { filter in
                                Text(filter.title).tag(filter)
                            }
                        }
                        .pickerStyle(.segmented)

                        if visibleTasks.isEmpty {
                            EmptyState(
                                icon: taskFilter == .completed ? "checkmark.circle" : "sparkles",
                                title: taskFilter == .completed ? "Nothing completed yet" : "You’re all caught up",
                                detail: taskFilter == .completed ? "Finished tasks will show here." : "Add a task when something needs your attention."
                            )
                            .frame(minHeight: 150)
                        } else {
                            ForEach(visibleTasks) { task in
                                TaskRow(task: task, isUpdating: store.updatingTaskIds.contains(task.id)) { Task { await store.toggle(task) } }
                            }
                        }
                    }

                    Text("CONNECTED TO \(store.businessName.uppercased())")
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .tracking(0.5)
                        .foregroundStyle(OverHeadStyle.muted)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 3)
                }
                .padding(.horizontal, 20)
                .padding(.top, 12)
                .padding(.bottom, 22)
            }
            .refreshable { await store.refresh() }
            .background(OverHeadStyle.canvas.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
        }
    }
}

private enum TaskFilter: String, CaseIterable, Identifiable {
    case open, completed, all
    var id: String { rawValue }
    var title: String {
        switch self {
        case .open: "Open"
        case .completed: "Done"
        case .all: "All"
        }
    }
}

private struct MetricCard: View {
    let value: String
    let title: String
    let icon: String
    let tint: Color

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(tint.opacity(0.11), in: RoundedRectangle(cornerRadius: 11))
            VStack(alignment: .leading, spacing: 3) {
                Text(value).font(.system(size: 25, weight: .bold, design: .rounded)).foregroundStyle(OverHeadStyle.ink)
                Text(title).font(.system(size: 12, weight: .medium)).foregroundStyle(OverHeadStyle.muted).lineLimit(2)
            }
            Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 86, alignment: .leading)
        .background(.white, in: RoundedRectangle(cornerRadius: 18))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(OverHeadStyle.line, lineWidth: 1))
    }
}

private struct QuickActionButton: View {
    let title: String
    let icon: String
    let tint: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 9) {
                Image(systemName: icon).font(.system(size: 15, weight: .bold))
                    .frame(width: 32, height: 32)
                    .background(tint.opacity(0.12), in: Circle())
                Text(title).font(.system(size: 14, weight: .semibold))
                Spacer(minLength: 0)
            }
            .foregroundStyle(OverHeadStyle.ink)
            .padding(12)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(.white, in: RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(OverHeadStyle.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

private struct TaskRow: View {
    let task: QuickTask
    let isUpdating: Bool
    let toggle: () -> Void

    private var kindLabel: String {
        switch task.kind {
        case .appointment: "APPOINTMENT"
        case .followUp: "FOLLOW-UP"
        case .task: "TASK"
        }
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button(action: toggle) {
                Group {
                    if isUpdating { ProgressView().controlSize(.small) }
                    else {
                        Image(systemName: task.done ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 23, weight: .regular))
                            .foregroundStyle(task.done ? OverHeadStyle.green : OverHeadStyle.muted.opacity(0.6))
                    }
                }
                .frame(width: 28, height: 28)
            }
            .buttonStyle(.plain)
            .disabled(isUpdating)
            VStack(alignment: .leading, spacing: 5) {
                Text(kindLabel)
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .tracking(0.8)
                    .foregroundStyle(OverHeadStyle.blue)
                Text(task.title)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(task.done ? OverHeadStyle.muted : OverHeadStyle.ink)
                    .strikethrough(task.done)
                if let customerName = task.customerName {
                    Text(customerName).font(.system(size: 12, weight: .medium)).foregroundStyle(OverHeadStyle.muted)
                }
            }
            Spacer(minLength: 4)
            if !task.dueLabel.isEmpty {
                Text(task.dueLabel)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(OverHeadStyle.muted)
                    .padding(.top, 2)
            }
        }
        .padding(15)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white, in: RoundedRectangle(cornerRadius: 17))
        .overlay(RoundedRectangle(cornerRadius: 17).stroke(OverHeadStyle.line, lineWidth: 1))
    }
}

struct OverHeadStyle {
    static let ink = Color(hex: 0x182923)
    static let muted = Color(hex: 0x718078)
    static let canvas = Color(hex: 0xF5F7F4)
    static let line = Color(hex: 0xE7ECE8)
    static let blue = Color(hex: 0x397B71)
    static let green = Color(hex: 0x538767)
    static let orange = Color(hex: 0xC77E43)
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}
