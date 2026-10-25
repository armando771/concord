package message

import (
	"errors"
	"strings"
	"testing"
	"time"
)

var pollNow = time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)

func twoAnswers() []PollAnswerInput {
	return []PollAnswerInput{{Text: "Pizza", Emoji: "🍕"}, {Text: "Sushi"}}
}

func TestBuildPollNumbersAnswersAndDefaultsDuration(t *testing.T) {
	poll, err := buildPoll(CreatePollInput{Question: "  Jantar?  ", Answers: twoAnswers()}, pollNow)
	if err != nil {
		t.Fatalf("buildPoll: %v", err)
	}
	if poll.Question != "Jantar?" {
		t.Fatalf("question = %q, want trimmed", poll.Question)
	}
	if poll.Answers[0].AnswerID != 1 || poll.Answers[1].AnswerID != 2 {
		t.Fatalf("answer ids = %d,%d, want 1,2", poll.Answers[0].AnswerID, poll.Answers[1].AnswerID)
	}
	if poll.Answers[0].Emoji == nil || *poll.Answers[0].Emoji != "🍕" || poll.Answers[1].Emoji != nil {
		t.Fatalf("emojis not kept per answer")
	}
	if want := pollNow.Add(24 * time.Hour); !poll.ExpiresAt.Equal(want) {
		t.Fatalf("expires_at = %v, want %v", poll.ExpiresAt, want)
	}
}

func TestBuildPollLimits(t *testing.T) {
	eleven := make([]PollAnswerInput, 11)
	for i := range eleven {
		eleven[i] = PollAnswerInput{Text: "x"}
	}

	cases := []struct {
		name  string
		input CreatePollInput
		want  error
	}{
		{"sem pergunta", CreatePollInput{Question: "  ", Answers: twoAnswers()}, ErrPollQuestionRequired},
		{"pergunta longa", CreatePollInput{Question: strings.Repeat("a", 301), Answers: twoAnswers()}, ErrPollQuestionTooLong},
		{"uma resposta", CreatePollInput{Question: "q", Answers: twoAnswers()[:1]}, ErrPollAnswerCount},
		{"onze respostas", CreatePollInput{Question: "q", Answers: eleven}, ErrPollAnswerCount},
		{"resposta vazia", CreatePollInput{Question: "q", Answers: []PollAnswerInput{{Text: "a"}, {Text: " "}}}, ErrPollAnswerRequired},
		{"resposta longa", CreatePollInput{Question: "q", Answers: []PollAnswerInput{{Text: "a"}, {Text: strings.Repeat("b", 56)}}}, ErrPollAnswerTooLong},
		{"duração inválida", CreatePollInput{Question: "q", Answers: twoAnswers(), DurationHours: 5}, ErrPollDurationInvalid},
		{"emoji e imagem", CreatePollInput{Question: "q", Answers: []PollAnswerInput{{Text: "a", Emoji: "🔥", ImageURL: "https://x/y.png"}, {Text: "b"}}}, ErrPollEmojiAndImage},
		{"imagem http", CreatePollInput{Question: "q", Answers: []PollAnswerInput{{Text: "a", ImageURL: "http://x/y.png"}, {Text: "b"}}}, ErrPollImageInvalid},
		{"emoji com texto", CreatePollInput{Question: "q", Answers: []PollAnswerInput{{Text: "a", Emoji: "não é emoji"}, {Text: "b"}}}, ErrPollEmojiInvalid},
	}
	for _, tc := range cases {
		if _, err := buildPoll(tc.input, pollNow); !errors.Is(err, tc.want) {
			t.Errorf("%s: err = %v, want %v", tc.name, err, tc.want)
		}
	}
}

func TestBuildPollCountsRunesNotBytes(t *testing.T) {
	answers := []PollAnswerInput{{Text: strings.Repeat("é", 55)}, {Text: "b"}}
	if _, err := buildPoll(CreatePollInput{Question: strings.Repeat("ç", 300), Answers: answers}, pollNow); err != nil {
		t.Fatalf("accented text at the limit rejected: %v", err)
	}
}

func openPoll(multiselect bool) *Poll {
	return &Poll{
		Answers:          []PollAnswer{{AnswerID: 1}, {AnswerID: 2}, {AnswerID: 3}},
		AllowMultiselect: multiselect,
		ExpiresAt:        pollNow.Add(time.Hour),
	}
}

func TestValidateVote(t *testing.T) {
	if err := validateVote(openPoll(false), []int{2}, pollNow); err != nil {
		t.Fatalf("single vote: %v", err)
	}
	if err := validateVote(openPoll(false), nil, pollNow); err != nil {
		t.Fatalf("removing vote: %v", err)
	}
	if err := validateVote(openPoll(true), []int{1, 3}, pollNow); err != nil {
		t.Fatalf("multiselect vote: %v", err)
	}
	if err := validateVote(openPoll(false), []int{1, 3}, pollNow); !errors.Is(err, ErrPollInvalidVote) {
		t.Fatalf("two answers without multiselect = %v, want ErrPollInvalidVote", err)
	}
	if err := validateVote(openPoll(true), []int{1, 1}, pollNow); !errors.Is(err, ErrPollInvalidVote) {
		t.Fatalf("repeated answer = %v, want ErrPollInvalidVote", err)
	}
	if err := validateVote(openPoll(false), []int{9}, pollNow); !errors.Is(err, ErrPollInvalidVote) {
		t.Fatalf("unknown answer = %v, want ErrPollInvalidVote", err)
	}
}

func TestValidateVoteRejectsClosedPoll(t *testing.T) {
	expired := openPoll(false)
	if err := validateVote(expired, []int{1}, pollNow.Add(time.Hour)); !errors.Is(err, ErrPollClosed) {
		t.Fatalf("expired poll = %v, want ErrPollClosed", err)
	}

	ended := openPoll(false)
	ended.EndedAt = &pollNow
	if err := validateVote(ended, []int{1}, pollNow); !errors.Is(err, ErrPollClosed) {
		t.Fatalf("ended poll = %v, want ErrPollClosed", err)
	}
}
