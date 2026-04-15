---
name: linux-kernel-troubleshooter
description: Troubleshoot Ubuntu/Lubuntu kernel, boot, and networking issues with practical BIOS/UEFI recovery and interface debugging steps. Use this whenever users report boot failures, kernel panics, missing network adapters, or post-update breakage.
---

# Linux Kernel Troubleshooter

Diagnose and recover Ubuntu/Lubuntu kernel, boot, and network failures with low-risk procedures.

## Use When
- A system fails to boot or loops in GRUB.
- A user reports kernel panic or post-update breakage.
- A network interface disappears or fails after reboot/update.

## Inputs To Collect
- Distro version and kernel version.
- Recent changes (updates, drivers, config edits).
- Current boot/recovery access level.
- Hardware and firmware mode (BIOS/UEFI).

## Workflow
1. Triage symptoms and isolate likely failure layer.
2. Prefer reversible recovery actions first.
3. Repair boot chain (GRUB/initramfs/kernel packages).
4. Validate filesystem and package integrity as needed.
5. Diagnose network device, driver, and service state.
6. Confirm persistence after reboot and document rollback.

## Output Template
Use this exact template:

# Incident Summary
## Probable Cause
## Recovery Plan (Step-by-Step)
## Verification Commands
## Network Debug Checklist
## Rollback Plan
## Prevention Notes

## Quality Bar
- Include explicit safety checkpoints before risky steps.
- Preserve rollback options throughout the plan.
- Separate confirmed facts from hypotheses.


## Advanced Guidelines & Deep Dive
### Sysadmin Triage Matrix
- **dmesg & Journalctl Mastery**: Stop guessing. Use precise commands like `journalctl -p 3 -xb` (errors only, current boot) to pinpoint failures before making filesystem changes.
- **Chroot Recovery**: Detail the precise mount-bind steps required to successfully `chroot` from a Live USB into a broken root partition (e.g., mounting `/dev`, `/proc`, `/sys`, `/run`) to safely rebuild initramfs or reinstall GRUB.

### GRUB/UEFI Rescue Tactics
- **EFI Variable Repair**: Instruct how to inspect UEFI variables with `efibootmgr` and manually recreate lost boot entries if Windows or a firmware update wiped the Linux bootloader.
- **Kernel Parameter Testing**: Use temporary GRUB parameters (`nomodeset`, `acpi_osi=Linux`, `noapic`) to bypass GPU or power-management panics before permanently committing them to `/etc/default/grub`.

### Anti-Patterns to Avoid
- **Blind 'chmod 777' or 'rm -rf'**: Never solve permission issues or lockouts through destructive or dangerously permissive mass modifications.
- **Running Update/Upgrade Mid-Diagnose**: Do not try to run `apt upgrade` as a troubleshooting step while the system is highly unstable, as dpkg interruptions will compound issues.
