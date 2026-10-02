package za.co.crimespot.user;

import java.util.UUID;

public record UserDto(UUID id, String email, String fullName, String phone, Role role, String friendCode) {
    public static UserDto from(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getPhone(), u.getRole(), u.getFriendCode());
    }
}
