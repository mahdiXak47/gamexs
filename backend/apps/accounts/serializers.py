import re

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import OTPCode

User = get_user_model()

_IRAN_PHONE_RE = re.compile(r"^09\d{9}$")


def _validate_phone(value: str) -> str:
    if not _IRAN_PHONE_RE.match(value):
        raise serializers.ValidationError("شماره موبایل باید با 09 شروع شده و 11 رقم باشد.")
    return value


class SignupSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=11)
    password = serializers.CharField(min_length=8, write_only=True)

    def validate_phone_number(self, value):
        _validate_phone(value)
        if User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("این شماره قبلا ثبت شده است.")
        return value

    def validate_password(self, value):
        if value.isdigit():
            raise serializers.ValidationError("رمز عبور نمی تواند فقط عدد باشد.")
        return value


class VerifyOTPSerializer(serializers.Serializer):
    otp_token = serializers.CharField()
    code = serializers.CharField(min_length=6, max_length=6)


class CompleteProfileSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=100)
    last_name = serializers.CharField(max_length=100)
    email = serializers.EmailField()

    def validate_email(self, value):
        user = self.context["request"].user
        if User.objects.filter(email=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("این ایمیل قبلا استفاده شده است.")
        return value


class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=11)
    password = serializers.CharField(write_only=True)

    def validate_phone_number(self, value):
        return _validate_phone(value)


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "phone_number", "first_name", "last_name", "email",
                  "is_phone_verified", "is_email_verified", "date_joined"]
        read_only_fields = ["id", "phone_number", "is_phone_verified", "is_email_verified", "date_joined"]

    def validate_email(self, value):
        user = self.instance
        if User.objects.filter(email=value).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("این ایمیل قبلا استفاده شده است.")
        return value
