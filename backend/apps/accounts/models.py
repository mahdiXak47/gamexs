import random
import string
import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, phone_number, password=None, **extra_fields):
        if not phone_number:
            raise ValueError("Phone number is required")
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)
        extra_fields.setdefault("is_phone_verified", True)
        extra_fields.setdefault("is_email_verified", True)
        return self.create_user(phone_number, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    phone_number = models.CharField(max_length=11, unique=True)
    first_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(unique=True, null=True, blank=True)

    is_active = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_phone_verified = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    date_joined = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "phone_number"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "accounts_user"

    def __str__(self):
        return self.phone_number

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()


class OTPCode(models.Model):
    PURPOSE_SIGNUP = "signup"
    PURPOSE_PASSWORD_RESET = "password_reset"
    PURPOSE_CHOICES = [
        (PURPOSE_SIGNUP, "Signup"),
        (PURPOSE_PASSWORD_RESET, "Password Reset"),
    ]

    phone_number = models.CharField(max_length=11)
    code = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "accounts_otpcode"
        indexes = [
            models.Index(fields=["phone_number", "purpose", "is_used"]),
        ]

    @classmethod
    def generate_code(cls):
        return "".join(random.choices(string.digits, k=6))

    @classmethod
    def create_for_phone(cls, phone_number, purpose, expiry_seconds):
        cls.objects.filter(phone_number=phone_number, purpose=purpose, is_used=False).update(is_used=True)
        return cls.objects.create(
            phone_number=phone_number,
            code=cls.generate_code(),
            purpose=purpose,
            expires_at=timezone.now() + timedelta(seconds=expiry_seconds),
        )

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"{self.phone_number} / {self.purpose}"


class EmailVerificationToken(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="email_token")
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = "accounts_emailverificationtoken"

    @classmethod
    def create_for_user(cls, user, expiry_hours):
        cls.objects.filter(user=user, is_used=False).delete()
        return cls.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(hours=expiry_hours),
        )

    @property
    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"token for {self.user.phone_number}"
