package main

import "testing"

func TestParseOSReleaseIdentifiesDerivative(t *testing.T) {
	values := parseOSRelease("# comment\nPRETTY_NAME=\"Kali GNU/Linux Rolling\"\nID=kali\nID_LIKE=debian\nVERSION_ID=2026.3\n")
	if values["ID"] != "kali" || values["PRETTY_NAME"] != "Kali GNU/Linux Rolling" || values["VERSION_ID"] != "2026.3" {
		t.Fatalf("unexpected parsed distro identity: %#v", values)
	}
	if got := splitLower(values["ID_LIKE"]); len(got) != 1 || got[0] != "debian" {
		t.Fatalf("unexpected derivative family: %#v", got)
	}
}

func TestBundledDerivativeGroupUsesOneRelease(t *testing.T) {
	system := target{DistroID: "linuxmint", DistroVersion: "22", DistroLike: []string{"ubuntu", "debian"}, Architecture: "x86_64", LibcName: "glibc", LibcVersion: "2.39"}
	appRelease := release{
		Version: "0.3.0",
		Minimum: map[string]any{"architecture": "x86_64"},
		CompatibleTargets: []compatibleTarget{{
			Name:           "Verified Debian derivatives",
			DistroIDs:      []string{"debian", "ubuntu", "linuxmint"},
			DistroFamilies: []string{"debian"},
			Verified:       true,
		}},
		Artifact: artifact{Name: "shared-linux.tar.gz", SHA256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"},
	}
	chosen, err := selectLinuxRelease(manifest{Platforms: map[string]struct {
		Releases []release `json:"releases"`
	}{"linux": {Releases: []release{appRelease}}}}, system)
	if err != nil {
		t.Fatal(err)
	}
	if chosen.Release.Version != "0.3.0" || chosen.Warning != "" {
		t.Fatalf("expected shared verified release, got %#v", chosen)
	}
}

func TestSelectorPrefersDistroSpecificReleaseAndHonorsVersionFloor(t *testing.T) {
	system := target{DistroID: "ubuntu", DistroName: "Ubuntu 24.04", DistroVersion: "24.04", DistroLike: []string{"debian"}, Architecture: "x86_64", LibcName: "glibc", LibcVersion: "2.39"}
	fallback := release{Version: "0.2.6", Minimum: map[string]any{"architecture": "x86_64"}, CompatibleTargets: []compatibleTarget{{Name: "Other glibc", Fallback: true, Warning: "fallback"}}}
	ubuntu := release{Version: "0.3.0", Minimum: map[string]any{"architecture": "x86_64"}, CompatibleTargets: []compatibleTarget{{Name: "Ubuntu", DistroIDs: []string{"ubuntu"}, MinimumVersions: map[string]string{"ubuntu": "24.04"}, Verified: true}}}
	catalog := manifest{Platforms: map[string]struct {
		Releases []release `json:"releases"`
	}{"linux": {Releases: []release{fallback, ubuntu}}}}
	chosen, err := selectLinuxRelease(catalog, system)
	if err != nil || chosen.Release.Version != "0.3.0" || chosen.Warning != "" {
		t.Fatalf("expected Ubuntu-specific release, got %#v, err=%v", chosen, err)
	}
	system.DistroVersion = "22.04"
	chosen, err = selectLinuxRelease(catalog, system)
	if err != nil || chosen.Release.Version != "0.2.6" || chosen.Warning != "fallback" {
		t.Fatalf("expected fallback for older Ubuntu, got %#v, err=%v", chosen, err)
	}
}

func TestUnverifiedDistroIsReported(t *testing.T) {
	system := target{DistroID: "fedora", DistroName: "Fedora Linux", DistroVersion: "43", Architecture: "x86_64", LibcName: "glibc", LibcVersion: "2.43"}
	appRelease := release{Version: "0.2.6", Minimum: map[string]any{"architecture": "x86_64"}, CompatibleTargets: []compatibleTarget{{Name: "Other glibc", Fallback: true, Warning: "not verified here"}}}
	chosen, err := selectLinuxRelease(manifest{Platforms: map[string]struct {
		Releases []release `json:"releases"`
	}{"linux": {Releases: []release{appRelease}}}}, system)
	if err != nil || chosen.Warning != "not verified here" {
		t.Fatalf("expected a compatibility warning, got %#v, err=%v", chosen, err)
	}
}
