ALTER TABLE notification_templates
    ADD COLUMN IF NOT EXISTS cta_url TEXT,
    ADD COLUMN IF NOT EXISTS cta_label VARCHAR(80),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

INSERT INTO notification_templates
    (code,channel,subject_template,body_template,category,title,greeting,signature,is_archived)
VALUES
    ('email_welcome_default','EMAIL','Welcome to {{churchName}}, {{firstName}}!','Your account is ready. We are glad to welcome you to our church community. Explore upcoming programs, announcements, and ways to take part.','WELCOME','Welcome to our church','Dear {{firstName}},','With care,\n{{churchName}}',FALSE),
    ('email_sunday_service_default','EMAIL','Join us for Sunday worship','We would be glad to worship with you this Sunday. {{eventDate}} {{eventTime}} {{eventLocation}}','SUNDAY_SERVICE','Sunday worship','Dear {{firstName}},','We look forward to seeing you,\n{{churchName}}',FALSE),
    ('email_conference_default','EMAIL','You are invited: {{title}}','Join us for {{title}}. {{eventDate}} {{eventTime}} {{eventLocation}}','CONFERENCE','Church conference','Dear {{firstName}},','You are warmly invited,\n{{churchName}}',FALSE),
    ('email_campaign_default','EMAIL','{{title}}','{{message}}','CAMPAIGN','Church campaign','Dear {{firstName}},','Thank you for being part of our community,\n{{churchName}}',FALSE),
    ('email_fundraising_default','EMAIL','Support {{title}}','{{message}}','FUNDRAISING','Fundraising update','Dear {{firstName}},','Thank you for your generosity,\n{{churchName}}',FALSE),
    ('email_announcement_default','EMAIL','{{title}}','{{message}}','ANNOUNCEMENT','Church announcement','Dear {{firstName}},','With care,\n{{churchName}}',FALSE)
ON CONFLICT (code) DO NOTHING;