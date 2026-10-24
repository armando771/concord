package server

import (
	"errors"
	"testing"
)

func TestOnlyOwnerChangesRoles(t *testing.T) {
	if err := validateRoleChange("dono", "dono", "ana", RoleModerator); err != nil {
		t.Fatalf("owner promoting: %v", err)
	}
	if err := validateRoleChange("dono", "dono", "ana", RoleMember); err != nil {
		t.Fatalf("owner demoting: %v", err)
	}
	if err := validateRoleChange("ana", "dono", "bia", RoleModerator); !errors.Is(err, ErrOnlyOwner) {
		t.Fatalf("moderator changing roles = %v, want ErrOnlyOwner", err)
	}
}

func TestOwnerRoleIsFixed(t *testing.T) {
	if err := validateRoleChange("dono", "dono", "dono", RoleMember); !errors.Is(err, ErrOwnerRole) {
		t.Fatalf("changing owner's role = %v, want ErrOwnerRole", err)
	}
}

func TestOnlyKnownRoles(t *testing.T) {
	if err := validateRoleChange("dono", "dono", "ana", "superadmin"); !errors.Is(err, ErrInvalidRole) {
		t.Fatalf("unknown role = %v, want ErrInvalidRole", err)
	}
}
