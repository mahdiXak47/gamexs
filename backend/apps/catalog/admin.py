from django import forms
from django.contrib import admin
from django.forms.models import BaseModelFormSet

from .models import PS5Game, Seller


class PS5GameAdminForm(forms.ModelForm):
    class Meta:
        model = PS5Game
        fields = "__all__"

    def clean(self):
        cleaned_data = super().clean()
        queryset = PS5Game.objects.exclude(pk=self.instance.pk)
        for field_name in ("hero_position", "preorder_hero_position"):
            position = cleaned_data.get(field_name)
            if position is not None and queryset.filter(**{field_name: position}).exists():
                self.add_error(field_name, f"Position {position} is already assigned to another game.")
        return cleaned_data


class PS5GameFormSet(BaseModelFormSet):
    """Validate positions across all rows submitted by list_editable."""

    def clean(self):
        super().clean()
        if any(self.errors):
            return

        for field_name in ("hero_position", "preorder_hero_position"):
            seen = {}
            for form in self.forms:
                position = form.cleaned_data.get(field_name)
                if position is None:
                    continue
                previous_form = seen.get(position)
                if previous_form is not None:
                    form.add_error(
                        field_name,
                        f"Position {position} is assigned more than once in this submission.",
                    )
                else:
                    seen[position] = form


@admin.register(PS5Game)
class PS5GameAdmin(admin.ModelAdmin):
    form = PS5GameAdminForm
    list_display = (
        "title",
        "slug",
        "is_popular",
        "is_newest",
        "hero_position",
        "preorder_hero_position",
    )
    list_editable = ("is_popular", "is_newest", "hero_position", "preorder_hero_position")
    list_filter = ("is_popular", "is_newest")
    search_fields = ("title", "slug")
    ordering = ("title",)

    def get_changelist_formset(self, request, **kwargs):
        """Use cross-row validation for list_editable submissions."""
        return super().get_changelist_formset(request, formset=PS5GameFormSet, **kwargs)


@admin.register(Seller)
class SellerAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "domain", "is_active")
    list_editable = ("is_active",)
    list_filter = ("is_active",)
    search_fields = ("name", "slug", "domain")
    ordering = ("name",)
