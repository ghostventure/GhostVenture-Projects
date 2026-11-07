import SwiftUI

struct ActivityView: View {
    @Environment(OverHeadStore.self) private var store

    var body: some View {
        NavigationStack {
            Group {
                if store.notes.isEmpty {
                    EmptyState(
                        icon: "text.bubble",
                        title: "No updates yet",
                        detail: store.canViewActivity
                            ? "Log a quick update from Today to add it to workspace activity."
                            : "Updates you log are shared with workspace managers."
                    )
                } else {
                    List(store.notes) { note in
                        VStack(alignment: .leading, spacing: 7) {
                            Text(note.text).font(.system(size: 15)).foregroundStyle(OverHeadStyle.ink)
                            HStack {
                                if let customer = note.customer { Text(customer) }
                                Text(note.createdAt.formatted(date: .abbreviated, time: .shortened))
                            }
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(OverHeadStyle.muted)
                        }
                        .padding(.vertical, 5)
                        .listRowBackground(Color.white)
                    }
                    .scrollContentBackground(.hidden)
                    .background(OverHeadStyle.canvas)
                }
            }
            .background(OverHeadStyle.canvas.ignoresSafeArea())
            .navigationTitle(store.canViewActivity ? "Workspace activity" : "My updates")
            .refreshable { await store.refresh() }
        }
    }
}
