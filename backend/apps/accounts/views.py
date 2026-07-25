from django.conf import settings
from django.contrib.auth import get_user_model
from django.shortcuts import redirect
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import EmailVerificationToken, OTPCode
from .otp_token import create_otp_token, decode_otp_token
from .serializers import (
    CompleteProfileSerializer,
    LoginSerializer,
    SignupSerializer,
    UserProfileSerializer,
    VerifyOTPSerializer,
)
from .services.email import send_verification_email
from .services.sms import sms_service

User = get_user_model()


def _jwt_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone_number"]
        password = serializer.validated_data["password"]

        # Stash hashed password temporarily in OTPCode.delivery_email is not a thing.
        # We store the raw (unhashed) password in the OTP record's phone_number field only
        # during signup — after OTP verify we hash it. To avoid a side-channel we keep it
        # in a short-lived signed OTP token instead of the DB.
        # Simpler: store hashed password on a pending User row that is_active=False.
        # Create (or update) the pending user now so we can store the hash safely.
        user, created = User.objects.update_or_create(
            phone_number=phone,
            defaults={"is_active": False, "is_phone_verified": False},
        )
        user.set_password(password)
        user.save(update_fields=["password"])

        expiry = getattr(settings, "OTP_EXPIRY_SECONDS", 120)
        otp = OTPCode.create_for_phone(phone, OTPCode.PURPOSE_SIGNUP, expiry)
        sms_service.send_otp(phone, otp.code)

        otp_token = create_otp_token(phone, OTPCode.PURPOSE_SIGNUP)
        return Response({"otp_token": otp_token}, status=status.HTTP_200_OK)


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        raw_token = serializer.validated_data["otp_token"]
        code = serializer.validated_data["code"]

        try:
            payload = decode_otp_token(raw_token)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        phone = payload["phone_number"]
        purpose = payload["purpose"]

        otp = OTPCode.objects.filter(
            phone_number=phone, purpose=purpose, is_used=False
        ).order_by("-created_at").first()

        if not otp:
            return Response({"detail": "کد OTP یافت نشد."}, status=status.HTTP_400_BAD_REQUEST)

        max_attempts = getattr(settings, "OTP_MAX_ATTEMPTS", 5)
        if otp.attempts >= max_attempts:
            return Response({"detail": "تعداد تلاش بیش از حد مجاز."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        if otp.is_expired:
            return Response({"detail": "کد OTP منقضی شده است."}, status=status.HTTP_400_BAD_REQUEST)

        otp.attempts += 1
        if otp.code != code:
            otp.save(update_fields=["attempts"])
            return Response({"detail": "کد OTP اشتباه است."}, status=status.HTTP_400_BAD_REQUEST)

        otp.is_used = True
        otp.save(update_fields=["attempts", "is_used"])

        try:
            user = User.objects.get(phone_number=phone)
        except User.DoesNotExist:
            return Response({"detail": "کاربر یافت نشد."}, status=status.HTTP_400_BAD_REQUEST)

        user.is_phone_verified = True
        user.is_active = True
        user.save(update_fields=["is_phone_verified", "is_active"])

        tokens = _jwt_for_user(user)
        tokens["needs_profile_completion"] = not (user.first_name and user.email)
        return Response(tokens, status=status.HTTP_200_OK)


class CompleteProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CompleteProfileSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.first_name = serializer.validated_data["first_name"]
        user.last_name = serializer.validated_data["last_name"]
        user.email = serializer.validated_data["email"]
        user.save(update_fields=["first_name", "last_name", "email"])

        expiry_hours = getattr(settings, "EMAIL_VERIFICATION_EXPIRY_HOURS", 24)
        token = EmailVerificationToken.create_for_user(user, expiry_hours)
        send_verification_email(user, str(token.token))

        return Response({"email_sent": True}, status=status.HTTP_200_OK)


class VerifyEmailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        raw_token = request.query_params.get("token", "")
        try:
            token_obj = EmailVerificationToken.objects.select_related("user").get(token=raw_token)
        except EmailVerificationToken.DoesNotExist:
            return Response({"detail": "لینک نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)

        if token_obj.is_used:
            return Response({"detail": "این لینک قبلا استفاده شده است."}, status=status.HTTP_400_BAD_REQUEST)

        if token_obj.is_expired:
            return Response({"detail": "لینک منقضی شده است."}, status=status.HTTP_400_BAD_REQUEST)

        token_obj.is_used = True
        token_obj.save(update_fields=["is_used"])

        user = token_obj.user
        user.is_email_verified = True
        user.is_active = True
        user.save(update_fields=["is_email_verified", "is_active"])

        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:3000")
        return redirect(f"{frontend_url}/account?activated=true")


class ResendVerificationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        if user.is_email_verified:
            return Response({"detail": "ایمیل قبلا تایید شده است."}, status=status.HTTP_400_BAD_REQUEST)
        if not user.email:
            return Response({"detail": "ابتدا پروفایل خود را تکمیل کنید."}, status=status.HTTP_400_BAD_REQUEST)

        expiry_hours = getattr(settings, "EMAIL_VERIFICATION_EXPIRY_HOURS", 24)
        token = EmailVerificationToken.create_for_user(user, expiry_hours)
        send_verification_email(user, str(token.token))
        return Response({"email_sent": True}, status=status.HTTP_200_OK)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        phone = serializer.validated_data["phone_number"]
        password = serializer.validated_data["password"]

        try:
            user = User.objects.get(phone_number=phone)
        except User.DoesNotExist:
            return Response({"detail": "اطلاعات ورود اشتباه است."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.check_password(password):
            return Response({"detail": "اطلاعات ورود اشتباه است."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_phone_verified:
            return Response(
                {"detail": "شماره موبایل تایید نشده است.", "code": "phone_not_verified"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not user.is_email_verified:
            # allow login but flag that email verification is pending
            tokens = _jwt_for_user(user)
            tokens["email_verified"] = False
            return Response(tokens, status=status.HTTP_200_OK)

        return Response(_jwt_for_user(user), status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response({"detail": "refresh token الزامی است."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError:
            return Response({"detail": "توکن نامعتبر است."}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        serializer = UserProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
