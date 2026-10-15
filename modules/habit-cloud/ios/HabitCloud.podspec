Pod::Spec.new do |s|
  s.name = 'HabitCloud'
  s.version = '1.0.0'
  s.summary = 'Immutable iCloud Documents snapshots for Tiny Habits'
  s.description = 'Local Expo module for versioned habit data synchronization.'
  s.license = { :type => 'MIT' }
  s.author = 'Habit App'
  s.homepage = 'https://github.com/xxzxx1024/habit-app'
  s.platforms = { :ios => '16.0' }
  s.swift_version = '5.9'
  s.source = { :git => 'https://github.com/xxzxx1024/habit-app.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
