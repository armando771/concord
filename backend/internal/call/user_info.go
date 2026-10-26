package call

import "context"

// userInfo monta os dados públicos de quem está na chamada (vão nos eventos).
func (s *Service) userInfo(ctx context.Context, userID string) (UserInfo, error) {
	u, err := s.userService.FindByID(ctx, userID)
	if err != nil {
		return UserInfo{}, err
	}
	return UserInfo{
		ID:          u.ID,
		Username:    u.Username,
		DisplayName: u.DisplayName,
		AvatarURL:   u.AvatarURL,
		NameStyle:   u.NameStyle,
	}, nil
}
