package channel

import (
	"errors"
	"testing"
)

func TestValidateOrderAcceptsAPermutation(t *testing.T) {
	current := []string{"a", "b", "c"}
	for _, ids := range [][]string{{"a", "b", "c"}, {"c", "a", "b"}, {"b", "c", "a"}} {
		if err := ValidateOrder(current, ids); err != nil {
			t.Fatalf("ValidateOrder(%v) = %v, want nil", ids, err)
		}
	}
}

func TestValidateOrderRejectsAnythingElse(t *testing.T) {
	current := []string{"a", "b", "c"}
	cases := map[string][]string{
		"faltando um":       {"a", "b"},
		"canal a mais":      {"a", "b", "c", "d"},
		"repetido":          {"a", "a", "b"},
		"de outro servidor": {"a", "b", "x"},
		"vazio":             {},
	}
	for name, ids := range cases {
		if err := ValidateOrder(current, ids); !errors.Is(err, ErrInvalidOrder) {
			t.Fatalf("%s: ValidateOrder(%v) = %v, want ErrInvalidOrder", name, ids, err)
		}
	}
}

func TestValidateOrderEmptySection(t *testing.T) {
	if err := ValidateOrder(nil, nil); err != nil {
		t.Fatalf("seção vazia = %v, want nil", err)
	}
}
