package level

import (
	"testing"

	"gin-quickstart/backend/internal/call"
)

func TestBoostPercentSteps(t *testing.T) {
	cases := map[int]int{
		0: 100, 1: 100, 2: 100, 3: 100,
		4: 125, 5: 125,
		6: 150, 7: 150,
		8: 175, 9: 175,
		10: 200, 11: 200, 50: 200,
	}
	for eligible, want := range cases {
		if got := boostPercent(eligible); got != want {
			t.Errorf("boostPercent(%d) = %d, want %d", eligible, got, want)
		}
	}
}

func TestCallBoostsGroupsByCallAndCountsDistinctUsers(t *testing.T) {
	active := []call.VoiceActivity{
		{UserID: "a", CallID: "c1"}, {UserID: "b", CallID: "c1"},
		{UserID: "c", CallID: "c1"}, {UserID: "d", CallID: "c1"},
		{UserID: "d", CallID: "c1"}, // duplicada: não conta duas vezes
		{UserID: "x", CallID: "c2"}, {UserID: "y", CallID: "c2"},
	}

	got := callBoosts(active)

	if got["c1"] != (callBoost{percent: 125, eligible: 4}) {
		t.Errorf("c1 = %+v, want 125%% with 4 eligible", got["c1"])
	}
	if got["c2"] != (callBoost{percent: 100, eligible: 2}) {
		t.Errorf("c2 = %+v, want 100%% with 2 eligible", got["c2"])
	}
}
