package za.co.crimespot.user;

import java.util.UUID;

/** Home coordinates are never returned, only whether a home area is set. */
public record UserDto(UUID id, String email, String fullName, String phone, Role role, String friendCode,
                      boolean hasHome, int alertRadiusM, String avatarUrl) {
    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getPhone(), u.getRole(), u.getFriendCode(),
                u.getHomeLat() != null, u.getAlertRadiusM(), u.getAvatarUrl());
    }
}
