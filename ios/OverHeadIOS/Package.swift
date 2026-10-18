// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "OverHeadIOS",
    platforms: [.iOS(.v17)],
    products: [.executable(name: "OverHeadIOS", targets: ["OverHeadIOS"])],
    dependencies: [
        .package(url: "https://github.com/firebase/firebase-ios-sdk.git", from: "11.0.0")
    ],
    targets: [
        .executableTarget(
            name: "OverHeadIOS",
            dependencies: [
                .product(name: "FirebaseAuth", package: "firebase-ios-sdk"),
                .product(name: "FirebaseCore", package: "firebase-ios-sdk"),
                .product(name: "FirebaseFirestore", package: "firebase-ios-sdk")
            ],
            path: "Sources"
        )
    ]
)
